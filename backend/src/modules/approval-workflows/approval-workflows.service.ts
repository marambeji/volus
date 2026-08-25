import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager, Not } from 'typeorm';
import { ApprovalWorkflow } from './entities/approval-workflow.entity';
import { ApprovalWorkflowStep } from './entities/approval-workflow-step.entity';
import { LeaveRule } from '../policies/entities/leave-rule.entity';
import { Employee } from '../employees/entities/employee.entity';
import { ApprovalInstance } from '../leave-requests/entities/approval-instance.entity';
import { CreateApprovalWorkflowDto } from './dto/create-approval-workflow.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflow.dto';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { ApproverType, ApprovalWorkflowStatus, AuditActionType } from '../../common/enums';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class ApprovalWorkflowsService {
  constructor(
    @InjectRepository(ApprovalWorkflow)
    private readonly workflowRepo: Repository<ApprovalWorkflow>,
    @InjectRepository(ApprovalWorkflowStep)
    private readonly stepRepo: Repository<ApprovalWorkflowStep>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditLogsService,
  ) { }

  private validateSteps(steps: CreateApprovalWorkflowDto['steps']) {
    const orders = steps.map((s) => s.stepOrder);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      throw new BadRequestException(
        'Step orders must be unique within a workflow.',
      );
    }
    // Rayan requirement: "Each workflow must contain between one and three ordered approval steps."
    if (steps.length < 1 || steps.length > 3) {
      throw new BadRequestException(
        'A workflow must contain between 1 and 3 ordered approval steps.',
      );
    }
    for (const step of steps) {
      if (
        step.approverType === ApproverType.SPECIFIC_PERSON &&
        !step.specificApproverId &&
        !step.specificApproverEmail
      ) {
        throw new BadRequestException(
          'SPECIFIC_PERSON steps must specify a specificApproverId or specificApproverEmail.',
        );
      }
      if (
        step.approverType !== ApproverType.SPECIFIC_PERSON &&
        (step.specificApproverId || step.specificApproverEmail)
      ) {
        throw new BadRequestException(
          'Only SPECIFIC_PERSON steps can specify a specificApproverId or specificApproverEmail.',
        );
      }
    }
  }

  async resolveWorkflow(
    countryId: string,
    leaveTypeId: string,
    effectiveDate: string,
  ): Promise<ApprovalWorkflow | null> {
    return this.workflowRepo
      .createQueryBuilder('wf')
      .leftJoinAndSelect('wf.steps', 'steps')
      .where('wf.countryId = :countryId', { countryId })
      .andWhere('wf.leaveTypeId = :leaveTypeId', { leaveTypeId })
      .andWhere('wf.status = :status', { status: ApprovalWorkflowStatus.ACTIVE })
      .andWhere('wf.effectiveFrom <= :effectiveDate', { effectiveDate })
      .andWhere('(wf.effectiveTo IS NULL OR wf.effectiveTo >= :effectiveDate)', { effectiveDate })
      .orderBy('wf.createdAt', 'DESC')
      .addOrderBy('steps.stepOrder', 'ASC')
      .getOne();
  }

  async create(dto: CreateApprovalWorkflowDto, actorId: string | null = null): Promise<ApprovalWorkflow> {
    const existing = await this.workflowRepo.findOne({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Workflow name already exists.');
    this.validateSteps(dto.steps);

    // Validate date logic
    if (dto.effectiveTo && new Date(dto.effectiveTo) < new Date(dto.effectiveFrom)) {
      throw new BadRequestException('Effective to date must be greater than or equal to effective from date.');
    }

    return this.dataSource.transaction(async (em) => {
      // Check overlaps only for country/leaveType-scoped workflows (not general ones)
      const isGeneral = !dto.countryId && !dto.leaveTypeId;
      if (!isGeneral && dto.status === ApprovalWorkflowStatus.ACTIVE) {
        await this.checkOverlap(em, null, dto.countryId, dto.leaveTypeId, dto.effectiveFrom, dto.effectiveTo ?? null);
      }

      const workflow = em.create(ApprovalWorkflow, {
        name: dto.name,
        description: dto.description ?? null,
        status: dto.status ?? ApprovalWorkflowStatus.ACTIVE,
        countryId: dto.countryId,
        leaveTypeId: dto.leaveTypeId,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: dto.effectiveTo ?? null,
        createdBy: actorId,
        lastModifiedBy: actorId,
      });
      const savedWorkflow = await em.save(workflow);

      const steps = dto.steps.map((s) =>
        em.create(ApprovalWorkflowStep, {
          workflowId: savedWorkflow.id,
          stepOrder: s.stepOrder,
          approverType: s.approverType,
          specificApproverId: s.specificApproverId ?? null,
          specificApproverEmail: s.specificApproverEmail ?? null,
          departmentId: s.departmentId ?? null,
          specificApproverEmployeeId: s.specificApproverEmployeeId ?? null,
          isRequired: s.isRequired ?? true,
        }),
      );
      await em.save(steps);

      const resolved = (await em.findOne(ApprovalWorkflow, {
        where: { id: savedWorkflow.id },
        relations: { steps: true },
      }))!;

      // Log audit
      await this.auditService.log(
        actorId,
        AuditActionType.WORKFLOW_CREATED,
        'ApprovalWorkflow',
        resolved.id,
        { newValues: resolved },
        em,
      );

      return resolved;
    });
  }

  async findAll(query: PaginationQueryDto) {
    const {
      page = 1,
      limit = 20,
      q,
      sortBy = 'name',
      sortOrder = 'ASC',
    } = query;
    const skip = (page - 1) * limit;
    const qb = this.workflowRepo
      .createQueryBuilder('wf')
      .leftJoinAndSelect('wf.steps', 'steps');
    if (q) qb.where('wf.name ILIKE :q', { q: `%${q}%` });
    qb.orderBy(`wf.${sortBy}`, sortOrder).skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<ApprovalWorkflow> {
    const wf = await this.workflowRepo.findOne({
      where: { id },
      relations: { steps: true },
    });
    if (!wf) throw new NotFoundException(`Workflow #${id} not found`);
    return wf;
  }

  async update(
    id: string,
    dto: UpdateApprovalWorkflowDto,
    actorId: string | null = null,
  ): Promise<ApprovalWorkflow> {
    const oldWorkflow = await this.findOne(id);
    if (dto.name) {
      const existing = await this.workflowRepo
        .createQueryBuilder('wf')
        .where('wf.name = :name', { name: dto.name })
        .andWhere('wf.id <> :id', { id })
        .getOne();
      if (existing)
        throw new ConflictException('Workflow name already in use.');
    }
    if (dto.steps) this.validateSteps(dto.steps);

    // Validate dates
    const effectiveFrom = dto.effectiveFrom ?? oldWorkflow.effectiveFrom;
    const effectiveTo = dto.effectiveTo !== undefined ? dto.effectiveTo : oldWorkflow.effectiveTo;
    if (effectiveTo && new Date(effectiveTo) < new Date(effectiveFrom)) {
      throw new BadRequestException('Effective to date must be greater than or equal to effective from date.');
    }

    return this.dataSource.transaction(async (em) => {
      // Check overlaps if active and only for country/leaveType-scoped workflows
      const status = dto.status ?? oldWorkflow.status;
      const countryId = dto.countryId ?? oldWorkflow.countryId;
      const leaveTypeId = dto.leaveTypeId ?? oldWorkflow.leaveTypeId;
      const isGeneral = !countryId && !leaveTypeId;

      if (!isGeneral && status === ApprovalWorkflowStatus.ACTIVE) {
        await this.checkOverlap(em, id, countryId, leaveTypeId, effectiveFrom, effectiveTo ?? null);
      }

      await em.update(ApprovalWorkflow, id, {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status && { status: dto.status }),
        ...(dto.countryId !== undefined && { countryId: dto.countryId || null }),
        ...(dto.leaveTypeId !== undefined && { leaveTypeId: dto.leaveTypeId || null }),
        ...(dto.effectiveFrom && { effectiveFrom: dto.effectiveFrom }),
        ...(dto.effectiveTo !== undefined && { effectiveTo: dto.effectiveTo }),
        lastModifiedBy: actorId,
      });

      if (dto.steps) {
        await em.delete(ApprovalWorkflowStep, { workflowId: id });
        const steps = dto.steps.map((s) =>
          em.create(ApprovalWorkflowStep, {
            workflowId: id,
            stepOrder: s.stepOrder,
            approverType: s.approverType,
            specificApproverId: s.specificApproverId ?? null,
            specificApproverEmail: s.specificApproverEmail ?? null,
            departmentId: s.departmentId ?? null,
            specificApproverEmployeeId: s.specificApproverEmployeeId ?? null,
            isRequired: s.isRequired ?? true,
          }),
        );
        await em.save(steps);
      }

      const resolved = (await em.findOne(ApprovalWorkflow, {
        where: { id },
        relations: { steps: true },
      }))!;

      // Log audit
      await this.auditService.log(
        actorId,
        AuditActionType.WORKFLOW_UPDATED,
        'ApprovalWorkflow',
        resolved.id,
        { oldValues: oldWorkflow, newValues: resolved },
        em,
      );

      return resolved;
    });
  }

  async remove(id: string, actorId: string | null = null): Promise<void> {
    const oldWorkflow = await this.findOne(id); // throws NotFoundException if not found

    await this.dataSource.transaction(async (em) => {
      // Find fallback workflow if any leave_rules are referencing this workflow
      const fallbackWorkflow = await em.findOne(ApprovalWorkflow, {
        where: { id: Not(id) },
        order: { createdAt: 'ASC' },
      });

      if (fallbackWorkflow) {
        await em
          .createQueryBuilder()
          .update(LeaveRule)
          .set({ approvalWorkflowId: fallbackWorkflow.id })
          .where('approval_workflow_id = :id', { id })
          .execute();
      } else {
        const referencingCount = await em
          .createQueryBuilder(LeaveRule, 'lr')
          .where('lr.approval_workflow_id = :id', { id })
          .getCount();

        if (referencingCount > 0) {
          throw new ConflictException(
            'Cannot delete the only remaining approval workflow because it is referenced by existing leave rules. Please create another workflow first.',
          );
        }
      }

      // Clean up approval_instances referencing steps of this workflow
      const steps = await em.find(ApprovalWorkflowStep, { where: { workflowId: id } });
      const stepIds = steps.map((s) => s.id);
      if (stepIds.length > 0) {
        await em
          .createQueryBuilder()
          .delete()
          .from(ApprovalInstance)
          .where('step_id IN (:...stepIds)', { stepIds })
          .execute();
      }

      // Clean up any remaining approval_instances referencing this workflow
      await em
        .createQueryBuilder()
        .delete()
        .from(ApprovalInstance)
        .where('workflow_id = :id', { id })
        .execute();

      // Also set any employees referencing this workflow to null
      await em
        .createQueryBuilder()
        .update(Employee)
        .set({ approvalWorkflowId: null })
        .where('approval_workflow_id = :id', { id })
        .execute();

      // Delete workflow steps
      await em.delete(ApprovalWorkflowStep, { workflowId: id });

      // Delete the approval workflow
      await em.delete(ApprovalWorkflow, id);

      // Log audit
      await this.auditService.log(
        actorId,
        AuditActionType.WORKFLOW_DELETED,
        'ApprovalWorkflow',
        id,
        { oldValues: oldWorkflow },
        em,
      );
    });
  }

  private async checkOverlap(
    em: EntityManager,
    workflowId: string | null,
    countryId?: string | null,
    leaveTypeId?: string | null,
    effectiveFrom?: string,
    effectiveTo?: string | null,
  ) {
    if (!effectiveFrom) return;
    const qb = em.createQueryBuilder(ApprovalWorkflow, 'wf')
      .where('wf.status = :status', { status: ApprovalWorkflowStatus.ACTIVE });

    if (countryId) {
      qb.andWhere('wf.countryId = :countryId', { countryId });
    } else {
      qb.andWhere('wf.countryId IS NULL');
    }

    if (leaveTypeId) {
      qb.andWhere('wf.leaveTypeId = :leaveTypeId', { leaveTypeId });
    } else {
      qb.andWhere('wf.leaveTypeId IS NULL');
    }

    if (workflowId) {
      qb.andWhere('wf.id <> :workflowId', { workflowId });
    }

    // Overlap condition logic
    if (effectiveTo === null || effectiveTo === undefined) {
      qb.andWhere('(wf.effectiveTo IS NULL OR wf.effectiveTo >= :effectiveFrom)', { effectiveFrom });
    } else {
      qb.andWhere(
        `((wf.effectiveTo IS NULL AND wf.effectiveFrom <= :effectiveTo) OR
          (wf.effectiveTo IS NOT NULL AND wf.effectiveFrom <= :effectiveTo AND wf.effectiveTo >= :effectiveFrom))`,
        { effectiveFrom, effectiveTo }
      );
    }

    const count = await qb.getCount();
    if (count > 0) {
      throw new BadRequestException('Config validation error: An active workflow already exists for the same scope and date range.');
    }
  }
}
