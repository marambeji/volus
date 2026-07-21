import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeePolicyAssignment } from './entities/employee-policy-assignment.entity';
import { LeavePolicy } from '../policies/entities/leave-policy.entity';
import { Country } from '../countries/entities/country.entity';
import { Division } from '../divisions/entities/division.entity';
import { ApprovalWorkflow } from '../approval-workflows/entities/approval-workflow.entity';
import { LeaveBalance } from '../leave-balances/entities/leave-balance.entity';
import { LeaveLedgerEntry } from '../leave-balances/entities/leave-ledger-entry.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { paginate } from '../../common/dto/pagination.dto';
import { EmployeeStatus, LedgerTransactionType } from '../../common/enums';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(EmployeePolicyAssignment)
    private readonly epaRepo: Repository<EmployeePolicyAssignment>,
    @InjectRepository(LeavePolicy)
    private readonly policyRepo: Repository<LeavePolicy>,
    @InjectRepository(Country)
    private readonly countryRepo: Repository<Country>,
    @InjectRepository(Division)
    private readonly divisionRepo: Repository<Division>,
    @InjectRepository(ApprovalWorkflow)
    private readonly workflowRepo: Repository<ApprovalWorkflow>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async resolveCountry(codeOrId: string): Promise<Country> {
    const country =
      (await this.countryRepo.findOne({ where: { code: codeOrId } })) ??
      (await this.countryRepo.findOne({ where: { id: codeOrId } }));
    if (!country) {
      throw new NotFoundException(
        `Country with code or ID "${codeOrId}" not found.`,
      );
    }
    return country;
  }

  private async validateManager(
    employeeId: string | null,
    managerId?: string | null,
  ): Promise<Employee | null> {
    if (!managerId) return null;

    if (employeeId && managerId === employeeId) {
      throw new BadRequestException('An employee cannot manage themselves.');
    }

    const manager = await this.employeeRepo.findOne({
      where: { id: managerId },
    });
    if (!manager) {
      throw new NotFoundException(`Manager #${managerId} not found.`);
    }
    if (manager.status === EmployeeStatus.ARCHIVED || manager.deletedAt) {
      throw new BadRequestException(
        'Cannot assign an archived employee as a manager.',
      );
    }

    // Cycle detection
    if (employeeId) {
      let currentManagerId: string | null | undefined = manager.managerId;
      const visited = new Set<string>([employeeId, managerId]);
      while (currentManagerId) {
        if (visited.has(currentManagerId)) {
          throw new BadRequestException(
            'Circular manager assignment detected.',
          );
        }
        visited.add(currentManagerId);
        const parent = await this.employeeRepo.findOne({
          where: { id: currentManagerId },
        });
        currentManagerId = parent?.managerId;
      }
    }

    return manager;
  }

  // Serialize Employee with active policy ID for frontend
  private serializeEmployee(employee: Employee, activePolicyId?: string) {
    let currentPolicyId = activePolicyId;
    if (!currentPolicyId && employee.policyAssignments?.length) {
      const active = employee.policyAssignments.find((a) => a.isActive);
      currentPolicyId = active?.leavePolicyId;
    }

    return {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      avatar: employee.avatar,
      jobTitle: employee.jobTitle,
      department: employee.department,
      unit: employee.unit,
      managerId: employee.managerId,
      countryId: employee.countryId,
      country: employee.country?.name,
      countryCode: employee.country?.code,
      divisionId: employee.divisionId,
      division: employee.division?.name,
      approvalWorkflowId: employee.approvalWorkflowId,
      approvalWorkflow: employee.approvalWorkflow?.name,
      policyId: currentPolicyId,
      status: employee.status,
      employmentType: employee.employmentType,
      workMode: employee.workMode,
      role: employee.role,
      hireDate: employee.hireDate,
      emergencyContacts: employee.emergencyContacts ?? [],
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }

  // ── Create ───────────────────────────────────────────────────────────────────

  async create(dto: CreateEmployeeDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.employeeRepo.findOne({
      where: { email, deletedAt: IsNull() },
    });
    if (existing) {
      throw new ConflictException(
        `An active employee with email "${email}" already exists.`,
      );
    }

    const country = await this.resolveCountry(dto.countryCode);
    await this.validateManager(null, dto.managerId);

    let policy = null;
    if (dto.policyId) {
      policy = await this.policyRepo.findOne({
        where: { id: dto.policyId },
        relations: { rules: { leaveType: true } },
      });
      if (!policy) {
        throw new NotFoundException(`LeavePolicy #${dto.policyId} not found.`);
      }
    } else {
      policy = await this.policyRepo.findOne({
        where: { country: { id: country.id } },
        relations: { rules: { leaveType: true } },
      });
      if (!policy) {
        throw new NotFoundException(`No default LeavePolicy found for country ${country.name}.`);
      }
    }

    const currentDate = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();

    const savedId = await this.dataSource.transaction(async (em) => {
      const employee = em.create(Employee, {
        employeeNumber: dto.employeeNumber ?? null,
        fullName: dto.fullName.trim(),
        email,
        phone: dto.phone ?? null,
        avatar: dto.avatar ?? null,
        jobTitle: dto.jobTitle.trim(),
        department: dto.department.trim(),
        unit: dto.unit?.trim() ?? null,
        managerId: dto.managerId ?? null,
        countryId: country.id,
        divisionId: dto.divisionId ?? null,
        approvalWorkflowId: dto.approvalWorkflowId ?? null,
        status: EmployeeStatus.ACTIVE,
        employmentType: dto.employmentType,
        workMode: dto.workMode,
        role: dto.role,
        hireDate: dto.hireDate,
        emergencyContacts: dto.emergencyContacts ?? [],
      });
      const savedEmployee = await em.save(employee);

      // Create initial policy assignment
      const assignment = em.create(EmployeePolicyAssignment, {
        employeeId: savedEmployee.id,
        leavePolicyId: policy.id,
        effectiveFrom: currentDate,
        effectiveTo: null,
        isActive: true,
      });
      await em.save(assignment);

      // Initialize leave balances & initial grant ledger entries
      for (const rule of policy.rules ?? []) {
        const entitlement = Number(rule.entitlementDays) || 0;
        const isFrontloaded = !rule.isAccrued && entitlement > 0;
        const initialBalance = isFrontloaded ? entitlement : 0;

        const balance = em.create(LeaveBalance, {
          employeeId: savedEmployee.id,
          leaveTypeId: rule.leaveTypeId,
          leavePolicyRuleId: rule.id,
          year: currentYear,
          availableBalance: initialBalance,
          usedYtd: 0,
          pending: 0,
          carriedOver: 0,
        });
        const savedBalance = await em.save(balance);

        if (isFrontloaded) {
          const ledgerEntry = em.create(LeaveLedgerEntry, {
            balanceId: savedBalance.id,
            employeeId: savedEmployee.id,
            leaveTypeId: rule.leaveTypeId,
            transactionType: LedgerTransactionType.INITIAL_GRANT,
            signedAmount: entitlement,
            resultingBalance: entitlement,
            reason: 'Initial frontloaded policy grant',
            referenceType: 'LEAVE_POLICY',
            referenceId: policy.id,
          });
          await em.save(ledgerEntry);
        }
      }

      return savedEmployee.id;
    });

    // Load after transaction commits so all relations are visible
    return this.findOne(savedId);
  }

  // ── FindAll ──────────────────────────────────────────────────────────────────

  async findAll(query: EmployeeQueryDto) {
    const {
      page = 1,
      limit = 20,
      q,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      countryId,
      divisionId,
      managerId,
      status,
      role,
      policyId,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.employeeRepo
      .createQueryBuilder('emp')
      .leftJoinAndSelect('emp.country', 'country')
      .leftJoinAndSelect('emp.division', 'division')
      .leftJoinAndSelect('emp.approvalWorkflow', 'workflow')
      .leftJoinAndSelect('emp.policyAssignments', 'epa', 'epa.is_active = true')
      .where('emp.deletedAt IS NULL');

    if (q) {
      qb.andWhere(
        '(emp.fullName ILIKE :q OR emp.email ILIKE :q OR emp.jobTitle ILIKE :q OR emp.department ILIKE :q)',
        { q: `%${q}%` },
      );
    }
    if (countryId) qb.andWhere('emp.countryId = :countryId', { countryId });
    if (divisionId) qb.andWhere('emp.divisionId = :divisionId', { divisionId });
    if (managerId) qb.andWhere('emp.managerId = :managerId', { managerId });
    if (status) qb.andWhere('emp.status = :status', { status });
    if (role) qb.andWhere('emp.role = :role', { role });
    if (policyId) qb.andWhere('epa.leavePolicyId = :policyId', { policyId });

    qb.orderBy(`emp.${sortBy}`, sortOrder).skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    const serialized = data.map((e) => this.serializeEmployee(e));
    return paginate(serialized, total, page, limit);
  }

  // ── FindOne ──────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: {
        country: true,
        division: true,
        approvalWorkflow: true,
        policyAssignments: true,
      },
    });
    if (!employee) throw new NotFoundException(`Employee #${id} not found.`);
    return this.serializeEmployee(employee);
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateEmployeeDto) {
    const employee = await this.employeeRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { policyAssignments: true },
    });
    if (!employee) throw new NotFoundException(`Employee #${id} not found.`);

    if (dto.email && this.normalizeEmail(dto.email) !== employee.email) {
      const email = this.normalizeEmail(dto.email);
      const existing = await this.employeeRepo.findOne({
        where: { email, deletedAt: IsNull() },
      });
      if (existing) {
        throw new ConflictException(
          `An active employee with email "${email}" already exists.`,
        );
      }
    }

    if (dto.managerId !== undefined) {
      await this.validateManager(id, dto.managerId);
    }

    const country = dto.countryCode
      ? await this.resolveCountry(dto.countryCode)
      : null;

    const currentDate = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();

    return this.dataSource.transaction(async (em) => {
      const updateData: Partial<Employee> = {};
      if (dto.fullName) updateData.fullName = dto.fullName.trim();
      if (dto.email) updateData.email = this.normalizeEmail(dto.email);
      if (dto.phone !== undefined) updateData.phone = dto.phone;
      if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
      if (dto.jobTitle) updateData.jobTitle = dto.jobTitle.trim();
      if (dto.department) updateData.department = dto.department.trim();
      if (dto.unit !== undefined) updateData.unit = dto.unit;
      if (dto.managerId !== undefined) updateData.managerId = dto.managerId;
      if (country) updateData.countryId = country.id;
      if (dto.divisionId !== undefined) updateData.divisionId = dto.divisionId;
      if (dto.approvalWorkflowId !== undefined)
        updateData.approvalWorkflowId = dto.approvalWorkflowId;
      if (dto.status) updateData.status = dto.status;
      if (dto.employmentType) updateData.employmentType = dto.employmentType;
      if (dto.workMode) updateData.workMode = dto.workMode;
      if (dto.role) updateData.role = dto.role;
      if (dto.hireDate) updateData.hireDate = dto.hireDate;
      if (dto.emergencyContacts)
        updateData.emergencyContacts = dto.emergencyContacts;

      if (Object.keys(updateData).length) {
        await em.update(Employee, id, updateData);
      }

      // Handle Policy Assignment Change
      if (dto.policyId) {
        const activeAssignment = employee.policyAssignments?.find(
          (a) => a.isActive,
        );
        if (
          !activeAssignment ||
          activeAssignment.leavePolicyId !== dto.policyId
        ) {
          const newPolicy = await em.findOne(LeavePolicy, {
            where: { id: dto.policyId },
            relations: { rules: { leaveType: true } },
          });
          if (!newPolicy) {
            throw new NotFoundException(
              `LeavePolicy #${dto.policyId} not found.`,
            );
          }

          if (activeAssignment) {
            activeAssignment.effectiveTo = currentDate;
            activeAssignment.isActive = false;
            await em.save(activeAssignment);
          }

          const newAssignment = em.create(EmployeePolicyAssignment, {
            employeeId: id,
            leavePolicyId: newPolicy.id,
            effectiveFrom: currentDate,
            effectiveTo: null,
            isActive: true,
          });
          await em.save(newAssignment);

          // Update/initialize leave balances for new policy rules without double-granting
          for (const rule of newPolicy.rules ?? []) {
            let balance = await em.findOne(LeaveBalance, {
              where: {
                employeeId: id,
                leaveTypeId: rule.leaveTypeId,
                year: currentYear,
              },
            });

            if (!balance) {
              const entitlement = Number(rule.entitlementDays) || 0;
              const isFrontloaded = !rule.isAccrued && entitlement > 0;
              const initialBalance = isFrontloaded ? entitlement : 0;

              balance = em.create(LeaveBalance, {
                employeeId: id,
                leaveTypeId: rule.leaveTypeId,
                leavePolicyRuleId: rule.id,
                year: currentYear,
                availableBalance: initialBalance,
                usedYtd: 0,
                pending: 0,
                carriedOver: 0,
              });
              const savedBalance = await em.save(balance);

              if (isFrontloaded) {
                const ledgerEntry = em.create(LeaveLedgerEntry, {
                  balanceId: savedBalance.id,
                  employeeId: id,
                  leaveTypeId: rule.leaveTypeId,
                  transactionType: LedgerTransactionType.INITIAL_GRANT,
                  signedAmount: entitlement,
                  resultingBalance: entitlement,
                  reason: 'Initial frontloaded policy grant',
                  referenceType: 'LEAVE_POLICY',
                  referenceId: newPolicy.id,
                });
                await em.save(ledgerEntry);
              }
            } else {
              // Update governing rule pointer without changing historical entitlement
              balance.leavePolicyRuleId = rule.id;
              await em.save(balance);
            }
          }
        }
      }

      return id;
    });

    // Load after transaction commits so all relations are visible
    return this.findOne(id);
  }

  // ── Remove ───────────────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    const employee = await this.employeeRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!employee) throw new NotFoundException(`Employee #${id} not found.`);

    // Clear managerId for direct reports
    await this.employeeRepo.update({ managerId: id }, { managerId: null });

    employee.status = EmployeeStatus.ARCHIVED;
    employee.deletedAt = new Date();
    await this.employeeRepo.save(employee);
  }

  // ── Leave Configuration ──────────────────────────────────────────────────────────

  async getLeaveConfiguration(employeeId: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId },
      relations: { country: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee #${employeeId} not found.`);
    }

    if (employee.status === EmployeeStatus.ARCHIVED || employee.deletedAt) {
      throw new BadRequestException(`Employee #${employeeId} is archived or deleted.`);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const assignments = await this.epaRepo
      .createQueryBuilder('epa')
      .leftJoinAndSelect('epa.leavePolicy', 'leavePolicy')
      .leftJoinAndSelect('leavePolicy.rules', 'rules')
      .leftJoinAndSelect('rules.leaveType', 'leaveType')
      .where('epa.employeeId = :employeeId', { employeeId })
      .andWhere('epa.isActive = :isActive', { isActive: true })
      .andWhere('epa.effectiveFrom <= :today', { today: todayStr })
      .andWhere('(epa.effectiveTo IS NULL OR epa.effectiveTo >= :today)', { today: todayStr })
      .getMany();

    if (assignments.length === 0) {
      throw new BadRequestException('No active leave policy assigned for the current date.');
    }

    if (assignments.length > 1) {
      throw new ConflictException('Multiple overlapping active policy assignments found.');
    }

    const assignment = assignments[0];
    const policy = assignment.leavePolicy;

    if (!policy) {
        throw new NotFoundException('Assigned policy not found.');
    }

    const currentYear = new Date().getFullYear();
    const balances = await this.dataSource.getRepository(LeaveBalance).find({
      where: { employeeId, year: currentYear },
    });

    const leaveTypesConfig = (policy.rules ?? [])
      .filter((rule: any) => rule.leaveType && rule.leaveType.isActive)
      .map((rule: any) => {
        const type = rule.leaveType;
        const balance = balances.find((b: any) => b.leaveTypeId === type.id);

        let eligible = true;
        const ineligibilityReasons: string[] = [];

        // Country eligibility
        if (rule.allowedCountries && rule.allowedCountries.length > 0) {
          const employeeCountry = employee.country?.code;
          if (!employeeCountry || !rule.allowedCountries.includes(employeeCountry)) {
            eligible = false;
            ineligibilityReasons.push('Your location is not eligible for this leave type.');
          }
        }

        // Seniority/Waiting Period
        if (rule.waitingPeriodDays > 0) {
          const hireDate = employee.hireDate;
          const seniorityDays = hireDate
            ? Math.floor((new Date().getTime() - new Date(hireDate).getTime()) / (1000 * 3600 * 24))
            : 0;
          if (seniorityDays < rule.waitingPeriodDays) {
            eligible = false;
            ineligibilityReasons.push(`Requires ${rule.waitingPeriodDays} days of seniority.`);
          }
        }

        return {
          leaveTypeId: type.id,
          code: type.key,
          name: type.label,
          trackingMode: type.trackingMode,
          availableBalance: Number(balance?.availableBalance ?? 0),
          usageYtd: Number(balance?.usedYtd ?? 0),
          allowsHalfDay: rule.allowsHalfDay ?? false,
          requiresNote: rule.requiresNote ?? false,
          requiresDocument: rule.requiresDocument ?? false,
          requiresPositiveBalance: rule.requiresPositiveBalance ?? true,
          minRequestDays: Number(rule.minRequestDays ?? 0.5),
          maxRequestDays: rule.maxRequestDays ? Number(rule.maxRequestDays) : null,
          maxConsecutiveDays: rule.maxConsecutiveDays ? Number(rule.maxConsecutiveDays) : null,
          waitingPeriodDays: rule.waitingPeriodDays ?? 0,
          allowedCountries: rule.allowedCountries ?? null,
          eligible,
          ineligibilityReasons,
        };
      });

    return {
      employeeId,
      policyId: policy.id,
      effectiveDate: todayStr,
      leaveTypes: leaveTypesConfig,
    };
  }
}
