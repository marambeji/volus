import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, IsNull } from 'typeorm';
import { createHash } from 'crypto';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveLedgerEntry } from './entities/leave-ledger-entry.entity';
import { Employee } from '../employees/entities/employee.entity';
import { LeaveType } from '../leave-types/entities/leave-type.entity';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { BalanceQueryDto } from './dto/balance-query.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { paginate } from '../../common/dto/pagination.dto';
import { LeaveTrackingMode, LedgerTransactionType, EmployeeStatus, LeavePolicyStatus, LeaveRequestStatus } from '../../common/enums';
import { LeaveRequest } from '../leave-requests/entities/leave-request.entity';
import { LeavePolicy } from '../policies/entities/leave-policy.entity';
import { EmployeePolicyAssignment } from '../employees/entities/employee-policy-assignment.entity';


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

  // ── Calculate Balances Engine ───────────────────────────────────────────────

  async calculateBalancesForEmployee(employeeId: string, year?: number) {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentYear = year || new Date().getFullYear();

    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId, deletedAt: IsNull() },
      relations: { policyAssignments: { leavePolicy: { rules: { leaveType: true } } } },  });

    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new ForbiddenException('Employee is not active');
    }

    const activeAssignments = (employee.policyAssignments || []).filter(
      (a) =>
        a.isActive &&
        a.effectiveFrom <= todayStr &&
        (!a.effectiveTo || a.effectiveTo >= todayStr)
    );

    if (activeAssignments.length === 0) {
      throw new BadRequestException('No active policy assignment found for the current date.');
    }
    if (activeAssignments.length > 1) {
      throw new ConflictException('Multiple overlapping active policy assignments found.');
    }

    const assignment = activeAssignments[0];
    const policy = await this.dataSource.getRepository(LeavePolicy).findOne({
      where: { id: assignment.leavePolicyId },
      relations: { rules: { leaveType: true } },
    });

    if (!policy) throw new NotFoundException('Leave policy not found');
    if (policy.status !== LeavePolicyStatus.ACTIVE) throw new BadRequestException('Assigned policy is not active');

    const ledgerEntries = await this.ledgerRepo.find({
      where: { employeeId },
    });

    const requestRepo = this.dataSource.getRepository(LeaveRequest);
    const pendingRequests = await requestRepo.find({
      where: { employeeId, status: LeaveRequestStatus.PENDING },
    });

    const results = [];

    for (const rule of (policy.rules || [])) {
      if (!rule.leaveType || !rule.leaveType.isActive) continue;
      
      const leaveTypeId = rule.leaveType.id;
      const typeLedger = ledgerEntries.filter(e => e.leaveTypeId === leaveTypeId && new Date(e.transactionDate).getFullYear() === currentYear);

      let openingBalance = 0;
      let accruedAmount = 0;
      let carriedOverAmount = 0;
      let manualAdjustments = 0;
      let approvedUsed = 0;

      for (const entry of typeLedger) {
        const amount = Number(entry.signedAmount);
        switch (entry.transactionType) {
          case LedgerTransactionType.INITIAL_GRANT:
            openingBalance += amount;
            break;
          case LedgerTransactionType.ACCRUAL:
            accruedAmount += amount;
            break;
          case LedgerTransactionType.CARRY_OVER:
            carriedOverAmount += amount;
            break;
          case LedgerTransactionType.MANUAL_ADJUSTMENT:
            manualAdjustments += amount;
            break;
          case LedgerTransactionType.USAGE:
            approvedUsed += Math.abs(amount);
            break;
          case LedgerTransactionType.REVERSAL:
            approvedUsed -= Math.abs(amount);
            break;
        }
      }

      const pendingAmount = pendingRequests
        .filter(r => r.leaveTypeId === leaveTypeId)
        .reduce((sum, r) => sum + Number(r.durationDays), 0);

      const availableBalance = openingBalance + accruedAmount + carriedOverAmount + manualAdjustments - approvedUsed;
      
      results.push({
        leaveTypeId: rule.leaveType.id,
        code: rule.leaveType.key,
        name: rule.leaveType.label,
        color: rule.leaveType.color || '#7C3AED',
        trackingMode: rule.leaveType.trackingMode,
        openingBalance,
        annualEntitlement: Number(rule.entitlementDays) || 0,
        accruedAmount,
        projectedAccrual: 0,
        carriedOverAmount,
        manualAdjustments,
        approvedUsed,
        pendingAmount,
        availableBalance: rule.leaveType.trackingMode === LeaveTrackingMode.USAGE_YTD ? 0 : availableBalance,
        usageYtd: approvedUsed,
        allowsHalfDay: rule.allowsHalfDay ?? false,
        requiresNote: rule.requiresNote ?? false,
        requiresDocument: rule.requiresDocument ?? false,
        requiresPositiveBalance: rule.requiresPositiveBalance ?? true,
      });
    }

    return {
      employeeId: employee.id,
      employeeName: employee.fullName,
      countryCode: employee.country?.code,
      policyId: policy.id,
      policyName: policy.policyName,
      period: {
        startDate: `${currentYear}-01-01`,
        endDate: `${currentYear}-12-31`,
      },
      balances: results,
    };
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
