import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApprovalWorkflow } from './entities/approval-workflow.entity';
import { ApprovalWorkflowStep } from './entities/approval-workflow-step.entity';
import { CreateApprovalWorkflowDto } from './dto/create-approval-workflow.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflow.dto';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { ApproverType } from '../../common/enums';

@Injectable()
export class ApprovalWorkflowsService {
  constructor(
    @InjectRepository(ApprovalWorkflow)
    private readonly workflowRepo: Repository<ApprovalWorkflow>,
    @InjectRepository(ApprovalWorkflowStep)
    private readonly stepRepo: Repository<ApprovalWorkflowStep>,
    private readonly dataSource: DataSource,
  ) {}

  private validateSteps(steps: CreateApprovalWorkflowDto['steps']) {
    const orders = steps.map((s) => s.stepOrder);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      throw new BadRequestException(
        'Step orders must be unique within a workflow.',
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

  async create(dto: CreateApprovalWorkflowDto): Promise<ApprovalWorkflow> {
    const existing = await this.workflowRepo.findOne({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Workflow name already exists.');
    this.validateSteps(dto.steps);

    return this.dataSource.transaction(async (em) => {
      const workflow = em.create(ApprovalWorkflow, {
        name: dto.name,
        status: dto.status,
      });
      const savedWorkflow = await em.save(workflow);

      const steps = dto.steps.map((s) =>
        em.create(ApprovalWorkflowStep, {
          workflowId: savedWorkflow.id,
          stepOrder: s.stepOrder,
          approverType: s.approverType,
          specificApproverId: s.specificApproverId ?? null,
          specificApproverEmail: s.specificApproverEmail ?? null,
          isRequired: s.isRequired ?? true,
        }),
      );
      await em.save(steps);

      return (await em.findOne(ApprovalWorkflow, {
        where: { id: savedWorkflow.id },
        relations: { steps: true },
      }))!;
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
  ): Promise<ApprovalWorkflow> {
    await this.findOne(id);
    if (dto.name) {
      const existing = await this.workflowRepo.findOne({
        where: { name: dto.name },
      });
      if (existing && existing.id !== id)
        throw new ConflictException('Workflow name already in use.');
    }
    if (dto.steps) this.validateSteps(dto.steps);

    return this.dataSource.transaction(async (em) => {
      await em.update(ApprovalWorkflow, id, {
        ...(dto.name && { name: dto.name }),
        ...(dto.status && { status: dto.status }),
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
            isRequired: s.isRequired ?? true,
          }),
        );
        await em.save(steps);
      }

      return (await em.findOne(ApprovalWorkflow, {
        where: { id },
        relations: { steps: true },
      }))!;
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // throws NotFoundException if not found / already deleted
    await this.workflowRepo.softDelete(id);
  }
}
