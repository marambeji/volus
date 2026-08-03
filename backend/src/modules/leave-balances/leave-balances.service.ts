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
      relations: {
        country: true,
        policyAssignments: { leavePolicy: { rules: { leaveType: true } } },
      },
    });

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

    const results: any[] = [];

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

      const entitlement = Number(rule.entitlementDays) || 0;

      // For USAGE_YTD types (e.g. Maternity, Paternity), treat entitlement as the
      // opening pool and compute remaining = entitlement - approvedUsed.
      // For BALANCE types (e.g. Annual, Sick), use the full ledger formula.
      const availableBalance =
        rule.leaveType.trackingMode === LeaveTrackingMode.USAGE_YTD
          ? Math.max(0, entitlement - approvedUsed)
          : openingBalance + accruedAmount + carriedOverAmount + manualAdjustments - approvedUsed;

      results.push({
        leaveTypeId: rule.leaveType.id,
        leaveTypeName: rule.leaveType.label,
        code: rule.leaveType.key,
        name: rule.leaveType.label,
        color: rule.leaveType.color || '#7C3AED',
        trackingMode: rule.leaveType.trackingMode,
        entitlement,
        earned: accruedAmount,
        adjustments: manualAdjustments,
        used: approvedUsed,
        pending: pendingAmount,
        available: availableBalance,
        remaining: availableBalance,
        openingBalance,
        annualEntitlement: entitlement,
        accruedAmount,
        projectedAccrual: 0,
        carriedOverAmount,
        manualAdjustments,
        approvedUsed,
        pendingAmount,
        availableBalance,
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
      countryId: employee.countryId,
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
      q: search,
      employeeId,
      leaveTypeId,
      transactionType,
      year,
      dateFrom,
      dateTo,
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

    if (search) {
      qb.andWhere('LOWER(employee.full_name) LIKE LOWER(:search)', {
        search: `%${search}%`,
      });
    }
    if (employeeId) qb.andWhere('l.employeeId = :employeeId', { employeeId });
    if (leaveTypeId)
      qb.andWhere('l.leaveTypeId = :leaveTypeId', { leaveTypeId });
    if (transactionType)
      qb.andWhere('l.transactionType = :transactionType', { transactionType });
    if (year)
      qb.andWhere('EXTRACT(YEAR FROM l.transactionDate) = :year', { year });
    if (dateFrom) qb.andWhere('l.transactionDate >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('l.transactionDate <= :dateTo', { dateTo });

    qb.orderBy('l.transactionDate', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    // Shape into clean DTO for Accrual History frontend
    const rows = data.map((l) => {
      const emp = l.employee;
      const lt = l.leaveType;
      const performer = l.performedByEmployee;

      // USAGE entries → usedDays (absolute value); others → earnedDays
      const isUsage = l.transactionType === 'USAGE';
      const usedDays = isUsage ? Math.abs(Number(l.signedAmount)) : 0;
      const earnedDays = !isUsage && Number(l.signedAmount) > 0 ? Number(l.signedAmount) : 0;

      return {
        id: l.id,
        employeeId: l.employeeId,
        employeeName: emp?.fullName ?? 'Unknown Employee',
        employeeAvatar: emp?.avatar ?? null,
        jobTitle: emp?.jobTitle ?? null,
        departmentName: emp?.department ?? null,
        email: emp?.email ?? null,
        leaveTypeId: l.leaveTypeId,
        leaveTypeName: lt?.label ?? lt?.key ?? 'Unknown',
        transactionType: l.transactionType,
        description: l.reason,
        signedAmount: Number(l.signedAmount),
        usedDays,
        earnedDays,
        balanceAfter: Number(l.resultingBalance),
        createdAt: l.transactionDate,
        createdBy: performer?.fullName ?? 'SYSTEM',
      };
    });

    return paginate(rows, total, page, limit);
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
          // Only block DEDUCTIONS (negative amounts) that would push balance below zero.
          // ADDITIONS (positive amounts) are always allowed — even if balance is already negative,
          // because the HR admin is intentionally correcting/restoring the balance.
          newBalance = Number(balance!.availableBalance) + amount;
          if (amount < 0 && newBalance < 0) {
            throw new BadRequestException(
              'Cannot deduct: resulting balance would be negative.',
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

  // ── Monthly/Yearly Accrual Engine ──────────────────────────────────────────

  /**
   * Compute accrual rate for a rule for a given employee, respecting Seniority Milestones.
   * Milestones are sorted by serviceYearsFrom ascending; the highest matching bracket wins.
   */
  private resolveAccrualRate(rule: any, serviceYears: number): number {
    const milestones: any[] = (rule.milestones || []).sort(
      (a: any, b: any) => a.serviceYearsFrom - b.serviceYearsFrom,
    );

    let resolved = rule.accrualRate ?? 0;
    for (const m of milestones) {
      const from = Number(m.serviceYearsFrom);
      const to = m.serviceYearsTo !== null ? Number(m.serviceYearsTo) : Infinity;
      if (serviceYears >= from && serviceYears < to) {
        resolved = Number(m.accrualRate);
        break;
      }
    }
    return resolved;
  }

  /**
   * Run accruals for all active employees whose policy has isAccrued rules.
   * Supports MONTHLY and YEARLY intervals.
   * Uses idempotency keys to ensure each period is only processed once per employee/leaveType.
   *
   * @param month  1-12 (default: current month)
   * @param year   (default: current year)
   */
  async runAccruals(month?: number, year?: number): Promise<{
    processedEmployees: number;
    accrualEntriesCreated: number;
    skipped: number;
    errors: { employeeId: string; leaveTypeId: string; error: string }[];
  }> {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1; // 1-12
    const targetYear = year ?? now.getFullYear();
    const periodStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const todayStr = now.toISOString().split('T')[0];

    let processedEmployees = 0;
    let accrualEntriesCreated = 0;
    let skipped = 0;
    const errors: { employeeId: string; leaveTypeId: string; error: string }[] = [];

    // 1. Load all active employees with their policy assignments and rules (including milestones)
    const employees = await this.employeeRepo.find({
      where: { status: EmployeeStatus.ACTIVE, deletedAt: IsNull() },
      relations: {
        policyAssignments: {
          leavePolicy: {
            rules: { leaveType: true, milestones: true },
          },
        },
      },
    });

    for (const employee of employees) {
      // 2. Find their active policy assignment for today
      const activeAssignments = (employee.policyAssignments || []).filter(
        (a) =>
          a.isActive &&
          a.effectiveFrom <= todayStr &&
          (!a.effectiveTo || a.effectiveTo >= todayStr),
      );

      if (activeAssignments.length !== 1) continue; // skip if no policy or ambiguous

      const policy = activeAssignments[0].leavePolicy;
      if (!policy || policy.status !== LeavePolicyStatus.ACTIVE) continue;

      processedEmployees++;

      // 3. Compute employee seniority in years
      const hireDate = new Date(employee.hireDate);
      const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
      const serviceYears = (now.getTime() - hireDate.getTime()) / msPerYear;

      for (const rule of policy.rules || []) {
        if (!rule.isAccrued || !rule.accrualRate || !rule.accrualInterval) continue;
        if (!rule.leaveType || !rule.leaveType.isActive) continue;

        // 4. Check if this rule's interval applies to the current period
        const isMonthlyCycle = rule.accrualInterval === 'MONTHLY';
        const isYearlyCycle = rule.accrualInterval === 'YEARLY';

        // For YEARLY: only process in January (month 1)
        if (isYearlyCycle && targetMonth !== 1) {
          skipped++;
          continue;
        }
        // For MONTHLY: always process
        if (!isMonthlyCycle && !isYearlyCycle) {
          skipped++;
          continue;
        }

        const idempotencyKey = `ACCRUAL:${employee.id}:${rule.leaveTypeId}:${periodStr}`;

        try {
          await this.dataSource.transaction(async (em) => {
            // 5. Idempotency check — skip if already processed this period
            const existing = await em.findOne(LeaveLedgerEntry, {
              where: { idempotencyKey },
            });
            if (existing) {
              skipped++;
              return;
            }

            // 6. Resolve accrual rate via seniority milestones
            const accrualRate = this.resolveAccrualRate(rule, serviceYears);
            if (accrualRate <= 0) {
              skipped++;
              return;
            }

            // 7. Find or create LeaveBalance for this employee/leaveType/year
            let balance = await em.findOne(LeaveBalance, {
              where: {
                employeeId: employee.id,
                leaveTypeId: rule.leaveTypeId,
                year: targetYear,
              },
              lock: { mode: 'pessimistic_write' },
            });

            if (!balance) {
              try {
                const newBal = em.create(LeaveBalance, {
                  employeeId: employee.id,
                  leaveTypeId: rule.leaveTypeId,
                  year: targetYear,
                  availableBalance: 0,
                  usedYtd: 0,
                  pending: 0,
                  carriedOver: 0,
                });
                await em.save(newBal);
              } catch (concurrentErr: unknown) {
                if ((concurrentErr as { code?: string })?.code !== '23505') throw concurrentErr;
              }
              balance = await em.findOne(LeaveBalance, {
                where: {
                  employeeId: employee.id,
                  leaveTypeId: rule.leaveTypeId,
                  year: targetYear,
                },
                lock: { mode: 'pessimistic_write' },
              });
            }

            if (!balance) throw new Error('Could not find or create leave balance');

            // 8. Apply balance cap if configured
            let finalAccrualAmount = accrualRate;
            if (rule.maxBalanceCap !== null && rule.maxBalanceCap !== undefined) {
              const currentBalance = Number(balance.availableBalance);
              const cap = Number(rule.maxBalanceCap);
              if (currentBalance >= cap) {
                skipped++;
                return; // Already at cap — skip accrual
              }
              // Clamp to avoid exceeding cap
              finalAccrualAmount = Math.min(accrualRate, cap - currentBalance);
            }

            const newBalance = Number(balance.availableBalance) + finalAccrualAmount;
            balance.availableBalance = newBalance;
            const savedBalance = await em.save(balance);

            // 9. Write the ACCRUAL ledger entry
            const monthName = new Date(targetYear, targetMonth - 1).toLocaleString('en-US', { month: 'long' });
            const intervalLabel = isMonthlyCycle ? 'Monthly' : 'Annual';
            const entry = em.create(LeaveLedgerEntry, {
              balanceId: savedBalance.id,
              employeeId: employee.id,
              leaveTypeId: rule.leaveTypeId,
              transactionType: LedgerTransactionType.ACCRUAL,
              signedAmount: finalAccrualAmount,
              resultingBalance: newBalance,
              reason: `${intervalLabel} accrual — ${monthName} ${targetYear}`,
              referenceType: 'ACCRUAL_JOB',
              idempotencyKey,
              performedByEmployeeId: null,
            });
            await em.save(entry);
            accrualEntriesCreated++;
          });
        } catch (err: unknown) {
          errors.push({
            employeeId: employee.id,
            leaveTypeId: rule.leaveTypeId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return { processedEmployees, accrualEntriesCreated, skipped, errors };
  }

  /**
   * Cron job: run monthly accruals automatically on the 1st of each month at 06:00 AM.
   * MONTHLY rules are processed every month.
   * YEARLY rules are processed only in January.
   */
  async handleMonthlyAccrualCron() {
    const now = new Date();
    console.log(`[AccrualCron] Starting accrual job for ${now.toISOString()}`);
    const result = await this.runAccruals(now.getMonth() + 1, now.getFullYear());
    console.log(`[AccrualCron] Completed: ${JSON.stringify(result)}`);
    return result;
  }
}

