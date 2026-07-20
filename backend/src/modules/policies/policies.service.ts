import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LeavePolicy } from './entities/leave-policy.entity';
import { LeaveRule } from './entities/leave-rule.entity';
import { SeniorityMilestone } from './entities/seniority-milestone.entity';
import { Country } from '../countries/entities/country.entity';
import { Division } from '../divisions/entities/division.entity';
import { ApprovalWorkflow } from '../approval-workflows/entities/approval-workflow.entity';
import { LeaveType } from '../leave-types/entities/leave-type.entity';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { PolicyQueryDto } from './dto/policy-query.dto';
import { CreateLeaveRuleDto } from './dto/create-leave-rule.dto';
import { paginate } from '../../common/dto/pagination.dto';
import { CutOffType } from '../../common/enums';

@Injectable()
export class PoliciesService {
  constructor(
    @InjectRepository(LeavePolicy)
    private readonly policyRepo: Repository<LeavePolicy>,
    @InjectRepository(LeaveRule)
    private readonly ruleRepo: Repository<LeaveRule>,
    @InjectRepository(SeniorityMilestone)
    private readonly milestoneRepo: Repository<SeniorityMilestone>,
    @InjectRepository(Country)
    private readonly countryRepo: Repository<Country>,
    @InjectRepository(Division)
    private readonly divisionRepo: Repository<Division>,
    @InjectRepository(ApprovalWorkflow)
    private readonly workflowRepo: Repository<ApprovalWorkflow>,
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepo: Repository<LeaveType>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async resolveCountry(code: string): Promise<Country> {
    const country = await this.countryRepo.findOne({ where: { code } });
    if (!country)
      throw new NotFoundException(`Country with code "${code}" not found.`);
    return country;
  }

  private async resolveDivisions(
    divisionAssignment?: string,
  ): Promise<Division[]> {
    if (!divisionAssignment || !divisionAssignment.trim()) return [];
    const names = divisionAssignment
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const divisions: Division[] = [];
    for (const name of names) {
      const div = await this.divisionRepo.findOne({ where: { name } });
      if (!div)
        throw new BadRequestException(
          `Division "${name}" not found. Create it first.`,
        );
      divisions.push(div);
    }
    return divisions;
  }

  private async resolveLeaveType(keyOrId: string): Promise<LeaveType> {
    const lt =
      (await this.leaveTypeRepo.findOne({ where: { key: keyOrId } })) ??
      (await this.leaveTypeRepo.findOne({ where: { id: keyOrId } }));
    if (!lt) throw new NotFoundException(`LeaveType "${keyOrId}" not found.`);
    return lt;
  }

  private async resolveWorkflow(id: string): Promise<ApprovalWorkflow> {
    const wf = await this.workflowRepo.findOne({ where: { id } });
    if (!wf) throw new NotFoundException(`ApprovalWorkflow #${id} not found.`);
    return wf;
  }

  private validateMilestones(
    milestones: CreateLeaveRuleDto['milestones'] = [],
  ) {
    if (!milestones.length) return;
    const sorted = [...milestones].sort(
      (a, b) => a.serviceYearsFrom - b.serviceYearsFrom,
    );
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      if (m.serviceYearsTo !== undefined && m.serviceYearsTo !== null) {
        if (m.serviceYearsTo <= m.serviceYearsFrom) {
          throw new BadRequestException(
            `Milestone at serviceYearsFrom=${m.serviceYearsFrom}: serviceYearsTo must be > serviceYearsFrom`,
          );
        }
      }
      if (i < sorted.length - 1) {
        const next = sorted[i + 1];
        if (m.serviceYearsTo !== undefined && m.serviceYearsTo !== null) {
          if (m.serviceYearsTo !== next.serviceYearsFrom) {
            throw new BadRequestException(
              `Milestone ranges must be continuous: gap or overlap between ${m.serviceYearsTo} and ${next.serviceYearsFrom}`,
            );
          }
        }
      }
    }
  }

  private normalizeRule(rule: CreateLeaveRuleDto): Partial<LeaveRule> {
    const base: Partial<LeaveRule> = {
      entitlementDays: rule.entitlementDays ?? null,
      isAccrued: rule.isAccrued,
      accrualRate: rule.isAccrued ? (rule.accrualRate ?? null) : null,
      accrualInterval: rule.isAccrued ? (rule.accrualInterval ?? null) : null,
      cutOffType: rule.cutOffType,
      cutOffMonth:
        rule.cutOffType === CutOffType.FIXED_DATE
          ? (rule.cutOffMonth ?? null)
          : null,
      cutOffDay:
        rule.cutOffType === CutOffType.FIXED_DATE
          ? (rule.cutOffDay ?? null)
          : null,
      resetType: rule.resetType,
      resetDaysCount: rule.resetDaysCount ?? null,
      carryOverEnabled: rule.carryOverEnabled,
      maxCarryOver: rule.carryOverEnabled ? (rule.maxCarryOver ?? null) : null,
      carryOverExpirationEnabled: rule.carryOverEnabled
        ? (rule.carryOverExpirationEnabled ?? false)
        : false,
      carryOverExpirationDays:
        rule.carryOverEnabled && rule.carryOverExpirationEnabled
          ? (rule.carryOverExpirationDays ?? null)
          : null,
      maxConsecutive: rule.maxConsecutive ?? 0,
      minNoticeDays: rule.minNoticeDays ?? 0,
      maxBalanceCap: rule.maxBalanceCap ?? null,
      waitingPeriodDays: rule.waitingPeriodDays ?? 0,
    };
    return base;
  }

  // Serialize policy to frontend-compatible shape
  private serializePolicy(policy: LeavePolicy) {
    return {
      id: policy.id,
      policyName: policy.policyName,
      country: policy.country?.name,
      countryCode: policy.country?.code,
      flag: policy.country?.flag,
      weekendDays: policy.weekendDays,
      workingHoursPerDay: policy.workingHoursPerDay,
      approvalWorkflow: policy.approvalWorkflow?.id,
      divisionAssignment: (policy.divisions ?? [])
        .map((d) => d.name)
        .join(', '),
      status: policy.status,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
      leaveQuotas: (policy.rules ?? []).map((r) => ({
        leaveType: r.leaveType?.key,
        entitlementDays: r.entitlementDays,
        isAccrued: r.isAccrued,
        accrualInterval: r.accrualInterval,
        accrualRate: r.accrualRate,
        cutOffType: r.cutOffType,
        cutOffMonth: r.cutOffMonth,
        cutOffDay: r.cutOffDay,
        resetType: r.resetType,
        resetDaysCount: r.resetDaysCount,
        carryOverEnabled: r.carryOverEnabled,
        maxCarryOver: r.maxCarryOver,
        carryOverExpirationEnabled: r.carryOverExpirationEnabled,
        carryOverExpirationDays: r.carryOverExpirationDays,
        maxConsecutive: r.maxConsecutive,
        minNoticeDays: r.minNoticeDays,
        maxBalanceCap: r.maxBalanceCap,
        waitingPeriodDays: r.waitingPeriodDays,
        seniorityMilestones: (r.milestones ?? []).map((m) => ({
          serviceYearsFrom: m.serviceYearsFrom,
          serviceYearsTo: m.serviceYearsTo,
          accrualRate: m.accrualRate,
          entitlementDays: m.entitlementDays,
          cap: m.cap,
        })),
      })),
    };
  }

  // ── Create ───────────────────────────────────────────────────────────────────

  async create(dto: CreatePolicyDto) {
    const [country, divisions, workflow] = await Promise.all([
      this.resolveCountry(dto.countryCode),
      this.resolveDivisions(dto.divisionAssignment),
      this.resolveWorkflow(dto.approvalWorkflowId),
    ]);

    // Validate unique leave types per policy
    if (dto.leaveQuotas?.length) {
      const keys = dto.leaveQuotas.map((r) => r.leaveType);
      if (new Set(keys).size !== keys.length) {
        throw new BadRequestException(
          'Each leave type can only appear once per policy.',
        );
      }
      for (const rule of dto.leaveQuotas) {
        this.validateMilestones(rule.milestones);
      }
    }

    return this.dataSource.transaction(async (em) => {
      const policy = em.create(LeavePolicy, {
        policyName: dto.policyName,
        countryId: country.id,
        workingHoursPerDay: dto.workingHoursPerDay,
        approvalWorkflowId: workflow.id,
        weekendDays: dto.weekendDays ?? [],
        status: dto.status,
        divisions,
      });
      const savedPolicy = await em.save(policy);

      if (dto.leaveQuotas?.length) {
        for (const ruleDto of dto.leaveQuotas) {
          const leaveType = await this.resolveLeaveType(ruleDto.leaveType);
          const rule = em.create(LeaveRule, {
            policyId: savedPolicy.id,
            leaveTypeId: leaveType.id,
            ...this.normalizeRule(ruleDto),
          });
          const savedRule = await em.save(rule);

          if (ruleDto.milestones?.length) {
            const milestones = ruleDto.milestones.map((m) =>
              em.create(SeniorityMilestone, {
                leaveRuleId: savedRule.id,
                serviceYearsFrom: m.serviceYearsFrom,
                serviceYearsTo: m.serviceYearsTo ?? null,
                accrualRate: m.accrualRate,
                entitlementDays: m.entitlementDays ?? null,
                cap: m.cap ?? null,
              }),
            );
            await em.save(milestones);
          }
        }
      }

      return this.findOne(savedPolicy.id);
    });
  }

  // ── FindAll ──────────────────────────────────────────────────────────────────

  async findAll(query: PolicyQueryDto) {
    const {
      page = 1,
      limit = 20,
      q,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      countryId,
      divisionId,
      leaveTypeId,
      status,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.policyRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.country', 'country')
      .leftJoinAndSelect('p.approvalWorkflow', 'workflow')
      .leftJoinAndSelect('p.divisions', 'division');

    if (q) qb.andWhere('p.policyName ILIKE :q', { q: `%${q}%` });
    if (countryId) qb.andWhere('p.countryId = :countryId', { countryId });
    if (status) qb.andWhere('p.status = :status', { status });
    if (divisionId) qb.andWhere('division.id = :divisionId', { divisionId });
    if (leaveTypeId)
      qb.andWhere((qb2) => {
        const sub = qb2
          .subQuery()
          .select('1')
          .from(LeaveRule, 'lr')
          .where('lr.policyId = p.id')
          .andWhere('lr.leaveTypeId = :leaveTypeId', { leaveTypeId })
          .getQuery();
        return `EXISTS ${sub}`;
      });

    qb.orderBy(`p.${sortBy}`, sortOrder).skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    const serialized = data.map((p) => ({
      id: p.id,
      policyName: p.policyName,
      country: p.country?.name,
      countryCode: p.country?.code,
      flag: p.country?.flag,
      status: p.status,
      workingHoursPerDay: p.workingHoursPerDay,
      divisionAssignment: (p.divisions ?? []).map((d) => d.name).join(', '),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
    return paginate(serialized, total, page, limit);
  }

  // ── FindOne ──────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const policy = await this.policyRepo.findOne({
      where: { id },
      relations: {
        country: true,
        approvalWorkflow: true,
        divisions: true,
        rules: { leaveType: true, milestones: true },
      },
    });
    if (!policy) throw new NotFoundException(`Policy #${id} not found`);
    return this.serializePolicy(policy);
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdatePolicyDto) {
    await this.findOne(id); // ensures exists

    const [country, divisions, workflow] = await Promise.all([
      dto.countryCode
        ? this.resolveCountry(dto.countryCode)
        : Promise.resolve(null),
      dto.divisionAssignment !== undefined
        ? this.resolveDivisions(dto.divisionAssignment)
        : Promise.resolve(null),
      dto.approvalWorkflowId
        ? this.resolveWorkflow(dto.approvalWorkflowId)
        : Promise.resolve(null),
    ]);

    if (dto.leaveQuotas?.length) {
      const keys = dto.leaveQuotas.map((r) => r.leaveType);
      if (new Set(keys).size !== keys.length)
        throw new BadRequestException(
          'Each leave type can only appear once per policy.',
        );
      for (const rule of dto.leaveQuotas)
        this.validateMilestones(rule.milestones);
    }

    return this.dataSource.transaction(async (em) => {
      const updateData: Partial<LeavePolicy> = {};
      if (dto.policyName) updateData.policyName = dto.policyName;
      if (country) updateData.countryId = country.id;
      if (dto.workingHoursPerDay)
        updateData.workingHoursPerDay = dto.workingHoursPerDay;
      if (workflow) updateData.approvalWorkflowId = workflow.id;
      if (dto.weekendDays) updateData.weekendDays = dto.weekendDays;
      if (dto.status) updateData.status = dto.status;

      if (Object.keys(updateData).length)
        await em.update(LeavePolicy, id, updateData);

      if (divisions !== null) {
        const policy = await em.findOne(LeavePolicy, {
          where: { id },
          relations: { divisions: true },
        });
        policy!.divisions = divisions;
        await em.save(policy);
      }

      if (dto.leaveQuotas) {
        // Delete existing rules (cascade deletes milestones)
        const existingRules = await em.find(LeaveRule, {
          where: { policyId: id },
        });
        if (existingRules.length) await em.delete(LeaveRule, { policyId: id });

        for (const ruleDto of dto.leaveQuotas) {
          const leaveType = await this.resolveLeaveType(ruleDto.leaveType);
          const rule = em.create(LeaveRule, {
            policyId: id,
            leaveTypeId: leaveType.id,
            ...this.normalizeRule(ruleDto),
          });
          const savedRule = await em.save(rule);

          if (ruleDto.milestones?.length) {
            const milestones = ruleDto.milestones.map((m) =>
              em.create(SeniorityMilestone, {
                leaveRuleId: savedRule.id,
                serviceYearsFrom: m.serviceYearsFrom,
                serviceYearsTo: m.serviceYearsTo ?? null,
                accrualRate: m.accrualRate,
                entitlementDays: m.entitlementDays ?? null,
                cap: m.cap ?? null,
              }),
            );
            await em.save(milestones);
          }
        }
      }

      return this.findOne(id);
    });
  }

  // ── Remove ───────────────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    const policy = await this.policyRepo.findOne({ where: { id } });
    if (!policy) throw new NotFoundException(`Policy #${id} not found`);
    await this.policyRepo.softRemove(policy);
  }
}
