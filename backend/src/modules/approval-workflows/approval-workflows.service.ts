import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { ApprovalWorkflow } from './entities/approval-workflow.entity';
import { ApprovalWorkflowStep } from './entities/approval-workflow-step.entity';
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
  ) {}

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
      if (step.approverType === ApproverType.SPECIFIC_PERSON) {
        if (!step.specificApproverId && !step.specificApproverEmail) {
          throw new BadRequestException(
            `Step ${step.stepOrder}: SPECIFIC_PERSON requires specificApproverId or specificApproverEmail.`,
          );
        }
      } else {
        if (step.specificApproverId || step.specificApproverEmail) {
          throw new BadRequestException(
            `Step ${step.stepOrder}: specificApproverId and specificApproverEmail must be null when approverType is not SPECIFIC_PERSON.`,
          );
        }
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
      // Check overlaps
      if (dto.status === ApprovalWorkflowStatus.ACTIVE) {
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
          departmentId: s.departmentId ?? null,
          specificApproverEmployeeId: s.specificApproverEmployeeId ?? s.specificApproverId ?? null,
          specificApproverId: s.specificApproverId ?? s.specificApproverEmployeeId ?? null,
          specificApproverEmail: s.specificApproverEmail ?? null,
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
        .andWhere('wf.deletedAt IS NULL')
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
      // Check overlaps if active
      const status = dto.status ?? oldWorkflow.status;
      const countryId = dto.countryId ?? oldWorkflow.countryId;
      const leaveTypeId = dto.leaveTypeId ?? oldWorkflow.leaveTypeId;

      if (status === ApprovalWorkflowStatus.ACTIVE) {
        await this.checkOverlap(em, id, countryId, leaveTypeId, effectiveFrom, effectiveTo ?? null);
      }

      await em.update(ApprovalWorkflow, id, {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status && { status: dto.status }),
        ...(dto.countryId && { countryId: dto.countryId }),
        ...(dto.leaveTypeId && { leaveTypeId: dto.leaveTypeId }),
        ...(dto.effectiveFrom && { effectiveFrom: dto.effectiveFrom }),
        ...(dto.effectiveTo !== undefined && { effectiveTo: dto.effectiveTo }),
        lastModifiedBy: actorId,
      });

      if (dto.steps) {
        // Update existing step rows in place (matched by position) instead of
        // delete+recreate — a step that's already been referenced by a
        // historical approval_instances.step_id FK cannot be deleted, so a
        // blanket delete here would break editing any workflow that has ever
        // actually been used.
        const existingSteps = await em.find(ApprovalWorkflowStep, {
          where: { workflowId: id },
          order: { stepOrder: 'ASC' },
        });
        const keepCount = Math.min(existingSteps.length, dto.steps.length);

        for (let i = 0; i < keepCount; i++) {
          const s = dto.steps[i];
          await em.update(ApprovalWorkflowStep, existingSteps[i].id, {
            stepOrder: s.stepOrder,
            approverType: s.approverType,
            departmentId: s.departmentId ?? null,
            specificApproverEmployeeId: s.specificApproverEmployeeId ?? s.specificApproverId ?? null,
            specificApproverId: s.specificApproverId ?? s.specificApproverEmployeeId ?? null,
            specificApproverEmail: s.specificApproverEmail ?? null,
            isRequired: s.isRequired ?? true,
          });
        }

        if (existingSteps.length > dto.steps.length) {
          const toRemove = existingSteps.slice(dto.steps.length).map((s) => s.id);
          await em.delete(ApprovalWorkflowStep, toRemove);
        }

        if (dto.steps.length > existingSteps.length) {
          const newSteps = dto.steps.slice(existingSteps.length).map((s) =>
            em.create(ApprovalWorkflowStep, {
              workflowId: id,
              stepOrder: s.stepOrder,
              approverType: s.approverType,
              departmentId: s.departmentId ?? null,
              specificApproverEmployeeId: s.specificApproverEmployeeId ?? s.specificApproverId ?? null,
              specificApproverId: s.specificApproverId ?? s.specificApproverEmployeeId ?? null,
              specificApproverEmail: s.specificApproverEmail ?? null,
              isRequired: s.isRequired ?? true,
            }),
          );
          await em.save(newSteps);
        }
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
      await em.softDelete(ApprovalWorkflow, id);
      
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
    countryId: string,
    leaveTypeId: string,
    effectiveFrom: string,
    effectiveTo: string | null,
  ) {
    const qb = em.createQueryBuilder(ApprovalWorkflow, 'wf')
      .where('wf.status = :status', { status: ApprovalWorkflowStatus.ACTIVE })
      .andWhere('wf.countryId = :countryId', { countryId })
      .andWhere('wf.leaveTypeId = :leaveTypeId', { leaveTypeId })
      .andWhere('wf.deletedAt IS NULL');

    if (workflowId) {
      qb.andWhere('wf.id <> :workflowId', { workflowId });
    }

    // Overlap condition logic
    if (effectiveTo === null) {
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
      throw new BadRequestException('Config validation error: An active workflow already exists for the same country, leave type and date range.');
    }
  }
}
