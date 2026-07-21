import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveLedgerEntry } from './entities/leave-ledger-entry.entity';
import { Employee } from '../employees/entities/employee.entity';
import { LeaveType } from '../leave-types/entities/leave-type.entity';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { BalanceQueryDto } from './dto/balance-query.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { paginate } from '../../common/dto/pagination.dto';
import { LeaveTrackingMode, LedgerTransactionType } from '../../common/enums';

@Injectable()
export class LeaveBalancesService {
  constructor(
    @InjectRepository(LeaveBalance)
    private readonly balanceRepo: Repository<LeaveBalance>,
    @InjectRepository(LeaveLedgerEntry)
    private readonly ledgerRepo: Repository<LeaveLedgerEntry>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepo: Repository<LeaveType>,
    private readonly dataSource: DataSource,
  ) {}

  private computeFingerprint(dto: AdjustBalanceDto): string {
    const normAmount = Number(dto.amount).toFixed(2);
    const normReason = dto.reason.trim();
    const raw = `${dto.employeeId}:${dto.leaveTypeId}:${dto.year}:${normAmount}:${normReason}`;
    // SHA-256 hex digest is always exactly 64 chars — fits VARCHAR(64)
    return createHash('sha256').update(raw).digest('hex');
  }

  // ── FindAll Balances ────────────────────────────────────────────────────────

  async findAll(query: BalanceQueryDto) {
    const {
      page = 1,
      limit = 20,
      employeeId,
      leaveTypeId,
      year,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.balanceRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.employee', 'employee')
      .leftJoinAndSelect('b.leaveType', 'leaveType')
      .leftJoinAndSelect('b.leavePolicyRule', 'policyRule');

    if (employeeId) qb.andWhere('b.employeeId = :employeeId', { employeeId });
    if (leaveTypeId)
      qb.andWhere('b.leaveTypeId = :leaveTypeId', { leaveTypeId });
    if (year) qb.andWhere('b.year = :year', { year });

    qb.orderBy(`b.${sortBy}`, sortOrder).skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  // ── FindByEmployee ──────────────────────────────────────────────────────────

  async findByEmployee(employeeId: string, year?: number) {
    const emp = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!emp) throw new NotFoundException(`Employee #${employeeId} not found.`);

    const qb = this.balanceRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.leaveType', 'leaveType')
      .leftJoinAndSelect('b.leavePolicyRule', 'policyRule')
      .where('b.employeeId = :employeeId', { employeeId });

    if (year) qb.andWhere('b.year = :year', { year });

    return qb.getMany();
  }

  // ── FindOne Balance ─────────────────────────────────────────────────────────

  async findOne(id: string) {
    const balance = await this.balanceRepo.findOne({
      where: { id },
      relations: { employee: true, leaveType: true, leavePolicyRule: true },
    });
    if (!balance) throw new NotFoundException(`LeaveBalance #${id} not found.`);
    return balance;
  }

  // ── FindAll Ledger Entries ──────────────────────────────────────────────────

  async findAllLedger(query: LedgerQueryDto) {
    const {
      page = 1,
      limit = 20,
      employeeId,
      leaveTypeId,
      transactionType,
      year,
      dateFrom,
      dateTo,
      sortBy = 'transactionDate',
      sortOrder = 'DESC',
    } = query;

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      throw new BadRequestException(
        'dateFrom must be less than or equal to dateTo.',
      );
    }

    const skip = (page - 1) * limit;

    const qb = this.ledgerRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.employee', 'employee')
      .leftJoinAndSelect('l.leaveType', 'leaveType')
      .leftJoinAndSelect('l.performedByEmployee', 'performer');

    if (employeeId) qb.andWhere('l.employeeId = :employeeId', { employeeId });
    if (leaveTypeId)
      qb.andWhere('l.leaveTypeId = :leaveTypeId', { leaveTypeId });
    if (transactionType)
      qb.andWhere('l.transactionType = :transactionType', { transactionType });
    if (year)
      qb.andWhere('EXTRACT(YEAR FROM l.transactionDate) = :year', { year });
    if (dateFrom) qb.andWhere('l.transactionDate >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('l.transactionDate <= :dateTo', { dateTo });

    qb.orderBy(`l.${sortBy}`, sortOrder).skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  // ── Adjust Balance (Atomic with Pessimistic Locking) ──────────────────────

  async adjust(dto: AdjustBalanceDto, performerEmployeeId?: string) {
    const fingerprint = this.computeFingerprint(dto);

    // 1. Idempotency Check
    if (dto.idempotencyKey) {
      const existingEntry = await this.ledgerRepo.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
        relations: { employee: true, leaveType: true },
      });
      if (existingEntry) {
        if (existingEntry.requestFingerprint === fingerprint) {
          return existingEntry;
        } else {
          throw new ConflictException(
            `Idempotency key "${dto.idempotencyKey}" already exists with a different payload fingerprint.`,
          );
        }
      }
    }

    // Validate employee and leave type exist
    const [emp, leaveType] = await Promise.all([
      this.employeeRepo.findOne({ where: { id: dto.employeeId } }),
      this.leaveTypeRepo.findOne({ where: { id: dto.leaveTypeId } }),
    ]);

    if (!emp)
      throw new NotFoundException(`Employee #${dto.employeeId} not found.`);
    if (!leaveType)
      throw new NotFoundException(`LeaveType #${dto.leaveTypeId} not found.`);

    try {
      return await this.dataSource.transaction(async (em) => {
        let balance = await em.findOne(LeaveBalance, {
          where: {
            employeeId: dto.employeeId,
            leaveTypeId: dto.leaveTypeId,
            year: dto.year,
          },
          lock: { mode: 'pessimistic_write' },
          // No JOIN relations: FOR UPDATE cannot be applied to nullable side of outer join in PostgreSQL
        });

        // Safe missing balance creation inside transaction
        if (!balance) {
          try {
            const newBal = em.create(LeaveBalance, {
              employeeId: dto.employeeId,
              leaveTypeId: dto.leaveTypeId,
              year: dto.year,
              availableBalance: 0,
              usedYtd: 0,
              pending: 0,
              carriedOver: 0,
            });
            await em.save(newBal);
          } catch (err: unknown) {
            // If concurrent insertion happened (code 23505), catch and proceed
            const code = (err as { code?: string })?.code;
            if (code !== '23505') throw err;
          }

          // Reload with lock (no relations: FOR UPDATE cannot be used with outer joins in PostgreSQL)
          balance = await em.findOne(LeaveBalance, {
            where: {
              employeeId: dto.employeeId,
              leaveTypeId: dto.leaveTypeId,
              year: dto.year,
            },
            lock: { mode: 'pessimistic_write' },
          });
        }

        let newBalance = 0;
        const amount = Number(dto.amount);

        if (leaveType.trackingMode === LeaveTrackingMode.USAGE_YTD) {
          newBalance = Number(balance!.usedYtd) + amount;
          if (newBalance < 0) {
            throw new BadRequestException('USAGE_YTD cannot be negative.');
          }
          balance!.usedYtd = newBalance;
        } else {
          // AVAILABLE_BALANCE
          newBalance = Number(balance!.availableBalance) + amount;
          if (newBalance < 0) {
            throw new BadRequestException(
              'AVAILABLE_BALANCE cannot be negative.',
            );
          }
          balance!.availableBalance = newBalance;
        }

        const savedBalance = await em.save(balance!);

        const ledgerEntry = em.create(LeaveLedgerEntry, {
          balanceId: savedBalance.id,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          transactionType: LedgerTransactionType.MANUAL_ADJUSTMENT,
          signedAmount: amount,
          resultingBalance: newBalance,
          reason: dto.reason.trim(),
          referenceType: 'MANUAL_ADJUSTMENT',
          idempotencyKey: dto.idempotencyKey ?? null,
          requestFingerprint: fingerprint,
          performedByEmployeeId: performerEmployeeId ?? null,
        });

        return await em.save(ledgerEntry);
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === '23505' && dto.idempotencyKey) {
        // Idempotency race condition caught
        const existingEntry = await this.ledgerRepo.findOne({
          where: { idempotencyKey: dto.idempotencyKey },
          relations: { employee: true, leaveType: true },
        });
        if (existingEntry) {
          if (existingEntry.requestFingerprint === fingerprint) {
            return existingEntry;
          } else {
            throw new ConflictException(
              `Idempotency key "${dto.idempotencyKey}" already exists with a different payload fingerprint.`,
            );
          }
        }
      }
      throw err;
    }
  }
}
