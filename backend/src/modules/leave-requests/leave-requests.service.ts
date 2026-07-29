import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { LeaveRequest } from './entities/leave-request.entity';
import { ApprovalInstance } from './entities/approval-instance.entity';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';
import {
  LeaveRequestStatus,
  LedgerTransactionType,
  ApproverType,
  ApprovalInstanceStatus,
  AuditActionType,
  EmployeeRole,
} from '../../common/enums';
import { LeaveLedgerEntry } from '../leave-balances/entities/leave-ledger-entry.entity';
import { LeaveBalance } from '../leave-balances/entities/leave-balance.entity';
import { Employee } from '../employees/entities/employee.entity';
import { LeaveType } from '../leave-types/entities/leave-type.entity';
import { ApprovalWorkflowsService } from '../approval-workflows/approval-workflows.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class LeaveRequestsService {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly requestRepo: Repository<LeaveRequest>,
    @InjectRepository(ApprovalInstance)
    private readonly instanceRepo: Repository<ApprovalInstance>,
    private readonly leaveBalancesService: LeaveBalancesService,
    private readonly workflowService: ApprovalWorkflowsService,
    private readonly auditService: AuditLogsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    employeeId: string,
    dto: { leaveTypeId: string; startDate: string; endDate: string; durationDays: number; reason?: string },
  ) {
    // Validate dates
    if (new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new BadRequestException('Start date must be less than or equal to end date.');
    }

    return this.dataSource.transaction(async (em) => {
      // 1. Resolve Employee & Manager Context
      const employee = await em.findOne(Employee, {
        where: { id: employeeId },
        relations: { manager: true },
      });
      if (!employee) throw new NotFoundException('Employee not found');

      // 2. Resolve exactly one active workflow based on Country, Leave Type and date range
      const workflow = await this.workflowService.resolveWorkflow(
        employee.countryId,
        dto.leaveTypeId,
        dto.startDate,
      );

      if (!workflow) {
        throw new BadRequestException(
          'No active approval workflow configured for your country, leave type, and effective dates.',
        );
      }

      // 3. Resolve approvers for the workflow steps and validate their presence
      const resolvedSteps: any[] = [];
      for (const step of workflow.steps) {
        let resolvedApproverId: string | null = null;

        if (step.approverType === ApproverType.MANAGER) {
          if (!employee.managerId) {
            throw new BadRequestException(
              `Submission failed: workflow requires a Manager but your manager is not set in the system.`,
            );
          }
          resolvedApproverId = employee.managerId;
        } else if (step.approverType === ApproverType.MANAGERS_MANAGER) {
          if (!employee.managerId) {
            throw new BadRequestException(
              `Submission failed: workflow requires a Manager''s Manager but your manager is not set.`,
            );
          }
          if (!employee.manager?.managerId) {
            throw new BadRequestException(
              `Submission failed: workflow requires a Manager''s Manager but your manager''s manager is not set.`,
            );
          }
          resolvedApproverId = employee.manager.managerId;
        } else if (step.approverType === ApproverType.SPECIFIC_PERSON) {
          const empId = (step as any).specificApproverEmployeeId || step.specificApproverId;
          if (empId) {
            resolvedApproverId = empId;
          } else if (step.specificApproverEmail) {
            const specEmp = await em.findOne(Employee, {
              where: { email: step.specificApproverEmail },
            });
            if (!specEmp) {
              throw new BadRequestException(
                `Submission failed: specific person approver with email ${step.specificApproverEmail} not found.`,
              );
            }
            resolvedApproverId = specEmp.id;
          } else {
            throw new BadRequestException('Submission failed: SPECIFIC_PERSON step lacks id and email configuration.');
          }
        } else if (step.approverType === ApproverType.HR) {
          // HR approvers are resolved on-the-fly when they perform the action
          resolvedApproverId = null;
        }

        resolvedSteps.push({
          stepId: step.id,
          stepOrder: step.stepOrder,
          approverType: step.approverType,
          resolvedApproverId,
          isRequired: step.isRequired,
        });
      }

      // 4. Validate leave type is in active policy (overdraft is allowed — balance may go negative)
      const balancesData = await this.leaveBalancesService.calculateBalancesForEmployee(employeeId);
      const balanceConfig = balancesData.balances.find((b) => b.leaveTypeId === dto.leaveTypeId);
      if (!balanceConfig) {
        throw new BadRequestException('Leave type is not available in your active policy.');
      }
      // NOTE: overdraft is intentionally permitted — balance will be stored as negative.

      // Create snapshot representation
      const snapshot = {
        id: workflow.id,
        name: workflow.name,
        steps: resolvedSteps,
      };

      // 5. Create Leave Request
      const request = em.create(LeaveRequest, {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        durationDays: dto.durationDays,
        reason: dto.reason,
        status: LeaveRequestStatus.PENDING,
        workflowSnapshot: snapshot,
      });

      const savedRequest = await em.save(request);

      // 6. Instantiate approval steps
      const instances = resolvedSteps.map((s) => {
        return em.create(ApprovalInstance, {
          requestId: savedRequest.id,
          workflowId: workflow.id,
          stepId: s.stepId,
          stepOrder: s.stepOrder,
          approverType: s.approverType,
          resolvedApproverId: s.resolvedApproverId,
          status: s.stepOrder === 1 ? ApprovalInstanceStatus.PENDING : ApprovalInstanceStatus.WAITING,
        });
      });

      await em.save(instances);

      // 7. Write audit log
      const logRequest = await em.findOne(LeaveRequest, {
        where: { id: savedRequest.id },
        relations: { leaveType: true, employee: true },
      });

      await this.auditService.log(
        employeeId,
        AuditActionType.LEAVE_REQUEST_SUBMITTED,
        'LeaveRequest',
        savedRequest.id,
        { newValues: logRequest || savedRequest },
        em,
      );

      // Return leave request with relations loaded
      return em.findOne(LeaveRequest, {
        where: { id: savedRequest.id },
        relations: { employee: true, leaveType: true, approvalInstances: true },
      });
    });
  }

  async getMyApprovals(employeeId: string) {
    const employee = await this.dataSource.getRepository(Employee).findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const qb = this.instanceRepo
      .createQueryBuilder('ai')
      .leftJoinAndSelect('ai.request', 'lr')
      .leftJoinAndSelect('lr.employee', 'emp')
      .leftJoinAndSelect('lr.leaveType', 'lt')
      .where('ai.status = :status', { status: ApprovalInstanceStatus.PENDING })
      .andWhere('lr.status = :reqStatus', { reqStatus: LeaveRequestStatus.PENDING });

    if (employee.role === EmployeeRole.HR_ADMIN) {
      qb.andWhere('(ai.resolvedApproverId = :employeeId OR ai.approverType = :hrType)', {
        employeeId,
        hrType: ApproverType.HR,
      });
    } else {
      qb.andWhere('ai.resolvedApproverId = :employeeId', { employeeId });
    }

    qb.orderBy('lr.createdAt', 'DESC');
    const instances = await qb.getMany();

    return instances.map((inst) => ({
      stepInstanceId: inst.id,
      requestId: inst.requestId,
      stepOrder: inst.stepOrder,
      approverType: inst.approverType,
      employeeId: inst.request?.employeeId,
      leaveTypeId: inst.request?.leaveTypeId,
      employeeName: inst.request?.employee?.fullName,
      leaveTypeName: inst.request?.leaveType?.label,
      startDate: inst.request?.startDate,
      endDate: inst.request?.endDate,
      durationDays: inst.request?.durationDays,
      reason: inst.request?.reason,
      submittedAt: inst.request?.createdAt,
    }));
  }

  async approveStep(requestId: string, actorId: string, decisionNote?: string) {
    return this.dataSource.transaction(async (em) => {
      // Pessimistic Lock Request (no relations to avoid FOR UPDATE on outer joins)
      const requestLock = await em.findOne(LeaveRequest, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!requestLock) throw new NotFoundException('Leave request not found');

      // Reload with relations after acquiring the lock
      const request = await em.findOne(LeaveRequest, {
        where: { id: requestId },
        relations: { approvalInstances: { step: true } },
      })!

      if (!request) throw new NotFoundException('Leave request not found');
      if (request.status !== LeaveRequestStatus.PENDING) {
        throw new BadRequestException('Action rejected: leave request is already finalized.');
      }

      // Check current PENDING step
      const steps = request.approvalInstances || [];
      const currentStep = steps.find((s) => s.status === ApprovalInstanceStatus.PENDING);
      if (!currentStep) {
        throw new BadRequestException('No pending approval step found for this request.');
      }

      // Validate authorization
      const actor = await em.findOne(Employee, { where: { id: actorId } });
      if (!actor) throw new UnauthorizedException('Invalid actor ID');

      const isHRType = currentStep.approverType === ApproverType.HR;
      const isResolvedMatch = currentStep.resolvedApproverId === actorId;

      if (isHRType) {
        if (actor.role !== EmployeeRole.HR_ADMIN) {
          throw new ForbiddenException('Only HR administrators can approve this step.');
        }
        currentStep.resolvedApproverId = actorId;
      } else {
        if (!isResolvedMatch) {
          throw new ForbiddenException('You are not authorized to approve this step.');
        }
      }

      // Update current step to APPROVED
      currentStep.status = ApprovalInstanceStatus.APPROVED;
      currentStep.decisionNote = decisionNote ?? null;
      currentStep.actionDate = new Date();
      await em.save(currentStep);

      // Audit Step Approval
      await this.auditService.log(
        actorId,
        AuditActionType.APPROVAL_STEP_APPROVED,
        'ApprovalInstance',
        currentStep.id,
        { newValues: { ...currentStep, employeeId: request.employeeId }, reason: decisionNote },
        em,
      );

      // Resolve next steps
      const orderedSteps = steps.sort((a, b) => a.stepOrder - b.stepOrder);
      const nextRequiredStep = orderedSteps.find(
        (s) => s.stepOrder > currentStep.stepOrder && (s.step?.isRequired ?? true),
      );

      if (nextRequiredStep) {
        // Skip intermediate optional steps
        for (const s of orderedSteps) {
          if (s.stepOrder > currentStep.stepOrder && s.stepOrder < nextRequiredStep.stepOrder) {
            s.status = ApprovalInstanceStatus.SKIPPED;
            s.actionDate = new Date();
            await em.save(s);

            await this.auditService.log(
              actorId,
              AuditActionType.APPROVAL_STEP_SKIPPED,
              'ApprovalInstance',
              s.id,
              { newValues: s },
              em,
            );
          }
        }

        // Set next required step to PENDING
        nextRequiredStep.status = ApprovalInstanceStatus.PENDING;
        await em.save(nextRequiredStep);
      } else {
        // No next required step -> Skip any remaining optional steps and fully APPROVE request
        for (const s of orderedSteps) {
          if (s.stepOrder > currentStep.stepOrder) {
            s.status = ApprovalInstanceStatus.SKIPPED;
            s.actionDate = new Date();
            await em.save(s);

            await this.auditService.log(
              actorId,
              AuditActionType.APPROVAL_STEP_SKIPPED,
              'ApprovalInstance',
              s.id,
              { newValues: s },
              em,
            );
          }
        }

        // Finalize Request as APPROVED
        request.status = LeaveRequestStatus.APPROVED;
        request.reviewerId = actorId;
        request.reviewedAt = new Date();
        await em.save(request);

        // Apply ledger usage atomically exactly once
        await this.applyLedger(em, request, LedgerTransactionType.USAGE, actorId);

        // Load relations for description clarity
        const logRequest = await em.findOne(LeaveRequest, {
          where: { id: request.id },
          relations: { leaveType: true, employee: true },
        });

        // Audit request approval
        await this.auditService.log(
          actorId,
          AuditActionType.LEAVE_REQUEST_APPROVED,
          'LeaveRequest',
          request.id,
          { newValues: logRequest || request },
          em,
        );
      }

      return em.findOne(LeaveRequest, {
        where: { id: requestId },
        relations: { approvalInstances: true, employee: true, leaveType: true },
      });
    });
  }

  async rejectStep(requestId: string, actorId: string, reason: string) {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required.');
    }

    return this.dataSource.transaction(async (em) => {
      // Pessimistic Lock Request (no relations to avoid FOR UPDATE on outer joins)
      const requestLock = await em.findOne(LeaveRequest, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!requestLock) throw new NotFoundException('Leave request not found');

      // Reload with relations after acquiring the lock
      const request = await em.findOne(LeaveRequest, {
        where: { id: requestId },
        relations: { approvalInstances: { step: true } },
      })!;

      if (!request) throw new NotFoundException('Leave request not found');

      if (request.status !== LeaveRequestStatus.PENDING) {
        throw new BadRequestException('Action rejected: leave request is already finalized.');
      }

      // Get current PENDING step
      const steps = request.approvalInstances || [];
      const currentStep = steps.find((s) => s.status === ApprovalInstanceStatus.PENDING);
      if (!currentStep) {
        throw new BadRequestException('No pending approval step found.');
      }

      // Authorization Check
      const actor = await em.findOne(Employee, { where: { id: actorId } });
      if (!actor) throw new UnauthorizedException('Invalid actor ID');

      const isHRType = currentStep.approverType === ApproverType.HR;
      const isResolvedMatch = currentStep.resolvedApproverId === actorId;

      if (isHRType) {
        if (actor.role !== EmployeeRole.HR_ADMIN) {
          throw new ForbiddenException('Only HR administrators can reject this step.');
        }
        currentStep.resolvedApproverId = actorId;
      } else {
        if (!isResolvedMatch) {
          throw new ConflictException(
            'This approval step is not currently active. The request is awaiting manager approval.',
          );
        }
      }

      // Reject current step
      currentStep.status = ApprovalInstanceStatus.REJECTED;
      currentStep.decisionNote = reason;
      currentStep.actionDate = new Date();
      await em.save(currentStep);

      // Audit step rejection
      await this.auditService.log(
        actorId,
        AuditActionType.APPROVAL_STEP_REJECTED,
        'ApprovalInstance',
        currentStep.id,
        { newValues: { ...currentStep, employeeId: request.employeeId }, reason },
        em,
      );

      // Skip all subsequent steps
      for (const s of steps) {
        if (s.stepOrder > currentStep.stepOrder) {
          s.status = ApprovalInstanceStatus.SKIPPED;
          s.actionDate = new Date();
          await em.save(s);

          await this.auditService.log(
            actorId,
            AuditActionType.APPROVAL_STEP_SKIPPED,
            'ApprovalInstance',
            s.id,
            { newValues: s },
            em,
          );
        }
      }

      // Reject the leave request
      request.status = LeaveRequestStatus.REJECTED;
      request.reviewerId = actorId;
      request.reviewedAt = new Date();
      request.rejectionReason = reason;
      await em.save(request);

      // Load relations for description clarity
      const logRequest = await em.findOne(LeaveRequest, {
        where: { id: request.id },
        relations: { leaveType: true, employee: true },
      });

      // Audit request rejection
      await this.auditService.log(
        actorId,
        AuditActionType.LEAVE_REQUEST_REJECTED,
        'LeaveRequest',
        request.id,
        { newValues: logRequest || request, reason },
        em,
      );

      return em.findOne(LeaveRequest, {
        where: { id: requestId },
        relations: { approvalInstances: true },
      });
    });
  }

  async cancel(employeeId: string, requestId: string) {
    return this.dataSource.transaction(async (em) => {
      // Pessimistic lock (no relations to avoid FOR UPDATE on outer joins)
      const requestLock = await em.findOne(LeaveRequest, {
        where: { id: requestId, employeeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!requestLock) throw new NotFoundException('Leave request not found');

      // Reload with relations after acquiring the lock
      const request = await em.findOne(LeaveRequest, {
        where: { id: requestId, employeeId },
        relations: { approvalInstances: true },
      })!

      if (!request) throw new NotFoundException('Leave request not found');
      if (request.status === LeaveRequestStatus.CANCELLED) return request;
      if (request.status === LeaveRequestStatus.REJECTED) {
        throw new BadRequestException('Cannot cancel a rejected request.');
      }

      const wasApproved = request.status === LeaveRequestStatus.APPROVED;

      // Skip all remaining steps
      const steps = request.approvalInstances || [];
      for (const s of steps) {
        if (s.status === ApprovalInstanceStatus.WAITING || s.status === ApprovalInstanceStatus.PENDING) {
          s.status = ApprovalInstanceStatus.SKIPPED;
          s.actionDate = new Date();
          await em.save(s);

          await this.auditService.log(
            employeeId,
            AuditActionType.APPROVAL_STEP_SKIPPED,
            'ApprovalInstance',
            s.id,
            { newValues: s },
            em,
          );
        }
      }

      // Set request to CANCELLED
      request.status = LeaveRequestStatus.CANCELLED;
      const saved = await em.save(request);

      // Load relations for description clarity
      const logRequest = await em.findOne(LeaveRequest, {
        where: { id: request.id },
        relations: { leaveType: true, employee: true },
      });

      // Audit request cancellation
      await this.auditService.log(
        employeeId,
        AuditActionType.LEAVE_REQUEST_CANCELLED,
        'LeaveRequest',
        request.id,
        { newValues: logRequest || request },
        em,
      );

      if (wasApproved) {
        // Reverse usage in ledger exactly once
        await this.applyLedger(em, request, LedgerTransactionType.REVERSAL, employeeId);
      }

      return saved;
    });
  }

  async hrFindAll(query: any, actorId?: string) {
    const { status, employeeId, department, country, leaveTypeId, startDate, endDate } = query;

    const actor = actorId
      ? await this.dataSource.getRepository(Employee).findOne({ where: { id: actorId } })
      : null;

    const qb = this.requestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.employee', 'emp')
      .leftJoinAndSelect('emp.country', 'country')
      .leftJoinAndSelect('emp.policyAssignments', 'epa', 'epa.is_active = true')
      .leftJoinAndSelect('epa.leavePolicy', 'leavePolicy')
      .leftJoinAndSelect('lr.leaveType', 'leaveType')
      .leftJoinAndSelect('lr.reviewer', 'reviewer')
      .leftJoinAndSelect('lr.approvalInstances', 'ai')
      .leftJoinAndSelect('ai.resolvedApprover', 'res');

    if (status) qb.andWhere('lr.status = :status', { status });
    if (employeeId) qb.andWhere('lr.employeeId = :employeeId', { employeeId });
    if (department) qb.andWhere('emp.department = :department', { department });
    if (country) qb.andWhere('country.name = :country', { country });
    if (leaveTypeId) qb.andWhere('lr.leaveTypeId = :leaveTypeId', { leaveTypeId });
    if (startDate) qb.andWhere('lr.startDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('lr.endDate <= :endDate', { endDate });

    qb.orderBy('lr.createdAt', 'DESC');

    const requests = await qb.getMany();
    return requests.map((lr) => {
      const instances = lr.approvalInstances || [];
      const currentPendingStep = instances.find(
        (ai) => ai.status === ApprovalInstanceStatus.PENDING,
      );
      const currentStepOrder = currentPendingStep?.stepOrder ?? null;
      const currentApproverType = currentPendingStep?.approverType ?? null;
      const currentStepStatus = currentPendingStep?.status ?? null;
      const currentApproverName =
        currentPendingStep?.resolvedApprover?.fullName ||
        (currentPendingStep?.approverType === ApproverType.HR ? 'HR Department' : 'Pending');

      let canApprove = false;
      let canReject = false;

      if (lr.status === LeaveRequestStatus.PENDING && currentPendingStep && actor) {
        if (currentPendingStep.approverType === ApproverType.HR) {
          canApprove = actor.role === EmployeeRole.HR_ADMIN;
          canReject = actor.role === EmployeeRole.HR_ADMIN;
        } else {
          canApprove = currentPendingStep.resolvedApproverId === actor.id;
          canReject = currentPendingStep.resolvedApproverId === actor.id;
        }
      }

      return {
        requestId: lr.id,
        employeeId: lr.employeeId,
        employeeName: lr.employee?.fullName,
        employeeEmail: lr.employee?.email,
        employeeNumber: lr.employee?.employeeNumber,
        department: lr.employee?.department,
        team: lr.employee?.unit,
        country: lr.employee?.country?.name,
        policyId: lr.employee?.policyAssignments?.[0]?.leavePolicyId,
        policyName: lr.employee?.policyAssignments?.[0]?.leavePolicy?.policyName,
        leaveTypeId: lr.leaveTypeId,
        leaveTypeName: lr.leaveType?.label,
        startDate: lr.startDate,
        endDate: lr.endDate,
        requestedDuration: lr.durationDays,
        halfDayInformation: null,
        employeeNote: lr.reason,
        supportingDocumentMetadata: null,
        currentStatus: lr.status,
        currentStepOrder,
        currentApproverType,
        currentStepStatus,
        currentApproverName,
        canApprove,
        canReject,
        submittedAt: lr.createdAt,
        reviewedAt: lr.reviewedAt,
        reviewer: lr.reviewer?.fullName,
        rejectionReason: lr.rejectionReason,
        workflowSnapshot: lr.workflowSnapshot,
        approvalInstances: instances.map((ai) => ({
          stepOrder: ai.stepOrder,
          approverType: ai.approverType,
          resolvedApproverName: ai.resolvedApprover?.fullName || 'Pending',
          status: ai.status,
          decisionNote: ai.decisionNote,
          actionDate: ai.actionDate,
        })),
      };
    });
  }

  // HR Approves as override / direct action (satisfies existing HR endpoints)
  async hrApprove(requestId: string, reviewerId: string) {
    return this.approveStep(requestId, reviewerId, 'Approved directly by HR override');
  }

  // HR Rejects as override
  async hrReject(requestId: string, reviewerId: string, reason: string) {
    return this.rejectStep(requestId, reviewerId, reason);
  }

  async getWhosOut() {
    const qb = this.requestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.employee', 'emp')
      .leftJoinAndSelect('lr.leaveType', 'leaveType')
      .where('lr.status IN (:...statuses)', {
        statuses: [LeaveRequestStatus.APPROVED, LeaveRequestStatus.PENDING],
      })
      .orderBy('lr.startDate', 'ASC');

    const requests = await qb.getMany();
    return requests.map((lr) => ({
      requestId: lr.id,
      employeeId: lr.employeeId,
      employeeName: lr.employee?.fullName,
      department: lr.employee?.department || 'Engineering',
      leaveTypeId: lr.leaveTypeId,
      leaveTypeName: lr.leaveType?.label,
      startDate: lr.startDate,
      endDate: lr.endDate,
      requestedDuration: lr.durationDays,
      status: lr.status,
    }));
  }

  private async getOrCreateBalance(
    em: EntityManager,
    employeeId: string,
    leaveTypeId: string,
    year: number,
  ): Promise<LeaveBalance> {
    let balance = await em.findOne(LeaveBalance, {
      where: { employeeId, leaveTypeId, year },
      lock: { mode: 'pessimistic_write' },
    });
    if (!balance) {
      try {
        const newBal = em.create(LeaveBalance, {
          employeeId,
          leaveTypeId,
          year,
          availableBalance: 0,
          usedYtd: 0,
          pending: 0,
          carriedOver: 0,
        });
        await em.save(newBal);
      } catch (err: any) {
        if (err.code !== '23505') throw err;
      }
      balance = await em.findOne(LeaveBalance, {
        where: { employeeId, leaveTypeId, year },
        lock: { mode: 'pessimistic_write' },
      });
    }
    return balance!;
  }

  private async applyLedger(em: EntityManager, request: LeaveRequest, type: LedgerTransactionType, performerId: string) {
    const year = new Date(request.startDate).getFullYear();
    const balance = await this.getOrCreateBalance(em, request.employeeId, request.leaveTypeId, year);

    const leaveType = await em.findOne(LeaveType, { where: { id: request.leaveTypeId } });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const amount = request.durationDays;
    const signedAmount = type === LedgerTransactionType.USAGE ? -amount : amount;

    let resultingBalance = 0;
    if (leaveType.trackingMode === 'USAGE_YTD') {
      resultingBalance = Number(balance.usedYtd) - signedAmount;
      balance.usedYtd = resultingBalance;
    } else {
      resultingBalance = Number(balance.availableBalance) + signedAmount;
      balance.availableBalance = resultingBalance;
    }

    await em.save(balance);

    const ledgerEntry = em.create(LeaveLedgerEntry, {
      balanceId: balance.id,
      employeeId: request.employeeId,
      leaveTypeId: request.leaveTypeId,
      transactionType: type,
      signedAmount,
      resultingBalance,
      reason: type === LedgerTransactionType.USAGE ? 'Approved Leave Request' : 'Cancelled approved leave request',
      referenceType: 'LEAVE_REQUEST',
      referenceId: request.id,
      performedByEmployeeId: performerId,
    });
    await em.save(ledgerEntry);

    // Audit ledger creation
    await this.auditService.log(
      performerId,
      type === LedgerTransactionType.USAGE ? AuditActionType.LEDGER_USAGE_CREATED : AuditActionType.LEDGER_REVERSAL_CREATED,
      'LeaveLedgerEntry',
      ledgerEntry.id,
      { newValues: ledgerEntry },
      em,
    );
  }

  private getApproverRoleLabel(approverType: ApproverType): string {
    switch (approverType) {
      case ApproverType.MANAGER:
        return "Employee’s Manager";
      case ApproverType.MANAGERS_MANAGER:
        return "Manager’s Manager";
      case ApproverType.SPECIFIC_PERSON:
        return "Specific Approver";
      case ApproverType.HR:
        return "HR Department";
      default:
        return "Approver";
    }
  }

  async getApprovalProgress(requestId: string, employeeId: string) {
    const request = await this.dataSource.getRepository(LeaveRequest).findOne({
      where: { id: requestId },
      relations: { approvalInstances: true, employee: true },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    const actor = await this.dataSource.getRepository(Employee).findOne({ where: { id: employeeId } });
    if (!actor || (request.employeeId !== employeeId && actor.role !== EmployeeRole.HR_ADMIN)) {
      throw new NotFoundException('Leave request not found');
    }

    const steps = [...(request.approvalInstances || [])].sort((a, b) => a.stepOrder - b.stepOrder);
    const currentPendingStep = steps.find((s) => s.status === ApprovalInstanceStatus.PENDING);

    const totalRequiredSteps = steps.length;
    const currentStepOrder = currentPendingStep?.stepOrder ?? null;
    const currentApproverType = currentPendingStep?.approverType ?? null;
    const currentApproverLabel = currentPendingStep
      ? this.getApproverRoleLabel(currentPendingStep.approverType)
      : null;

    let finalDecision: string | null = null;
    let finalDecisionDate: string | null = null;

    if (request.status === LeaveRequestStatus.APPROVED) {
      finalDecision = 'APPROVED';
      finalDecisionDate = request.reviewedAt ? request.reviewedAt.toISOString() : request.updatedAt.toISOString();
    } else if (request.status === LeaveRequestStatus.REJECTED) {
      finalDecision = 'REJECTED';
      finalDecisionDate = request.reviewedAt ? request.reviewedAt.toISOString() : request.updatedAt.toISOString();
    } else if (request.status === LeaveRequestStatus.CANCELLED) {
      finalDecision = 'CANCELLED';
      finalDecisionDate = request.updatedAt ? request.updatedAt.toISOString() : null;
    }

    return {
      requestId: request.id,
      requestStatus: request.status,
      submittedAt: request.createdAt,
      currentStepOrder,
      totalRequiredSteps,
      currentApproverType,
      currentApproverLabel,
      finalDecision,
      finalDecisionDate,
      rejectionReason: request.rejectionReason ?? null,
      steps: steps.map((s) => ({
        approvalInstanceId: s.id,
        stepOrder: s.stepOrder,
        approverType: s.approverType,
        label: this.getApproverRoleLabel(s.approverType),
        status: s.status,
        actionDate: s.actionDate ?? null,
        decisionNote: s.decisionNote ?? null,
      })),
    };
  }

  async findOneWithOwnership(requestId: string, employeeId: string) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: { approvalInstances: true, leaveType: true, employee: true },
    });

    if (!request) throw new NotFoundException('Leave request not found');

    const actor = await this.dataSource.getRepository(Employee).findOne({ where: { id: employeeId } });
    if (!actor) throw new UnauthorizedException('Invalid employee ID');

    if (request.employeeId !== employeeId && actor.role !== EmployeeRole.HR_ADMIN) {
      throw new NotFoundException('Leave request not found');
    }

    return request;
  }

  async findMyRequests(employeeId: string) {
    const requests = await this.requestRepo.find({
      where: { employeeId },
      relations: { leaveType: true, approvalInstances: true },
      order: { createdAt: 'DESC' },
    });

    return requests.map((lr) => {
      const steps = [...(lr.approvalInstances || [])].sort((a, b) => a.stepOrder - b.stepOrder);
      const currentPendingStep = steps.find((s) => s.status === ApprovalInstanceStatus.PENDING);
      const currentStepOrder = currentPendingStep?.stepOrder ?? null;
      const currentApproverType = currentPendingStep?.approverType ?? null;
      const currentApproverLabel = currentPendingStep
        ? this.getApproverRoleLabel(currentPendingStep.approverType)
        : null;

      return {
        id: lr.id,
        requestId: lr.id,
        employeeId: lr.employeeId,
        leaveTypeId: lr.leaveTypeId,
        leaveType: lr.leaveType,
        startDate: lr.startDate,
        endDate: lr.endDate,
        durationDays: lr.durationDays,
        reason: lr.reason,
        status: lr.status,
        rejectionReason: lr.rejectionReason,
        createdAt: lr.createdAt,
        updatedAt: lr.updatedAt,
        currentStepOrder,
        totalRequiredSteps: steps.length,
        currentApproverType,
        currentApproverLabel,
        approvalInstances: steps.map((s) => ({
          approvalInstanceId: s.id,
          stepOrder: s.stepOrder,
          approverType: s.approverType,
          label: this.getApproverRoleLabel(s.approverType),
          decisionNote: s.decisionNote,
        })),
      };
    });
  }

  async processExpiredRequests(): Promise<{ processedCount: number; autoApprovedIds: string[] }> {
    const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - FIVE_DAYS_MS);

    // Find pending requests older than 5 days
    const expiredRequests = await this.requestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.approvalInstances', 'ai')
      .where('lr.status = :status', { status: LeaveRequestStatus.PENDING })
      .andWhere('lr.createdAt <= :cutoffDate', { cutoffDate })
      .getMany();

    const autoApprovedIds: string[] = [];

    for (const req of expiredRequests) {
      try {
        await this.dataSource.transaction(async (em) => {
          const request = await em.findOne(LeaveRequest, {
            where: { id: req.id },
            lock: { mode: 'pessimistic_write' },
            relations: { approvalInstances: { step: true } },
          });

          if (!request || request.status !== LeaveRequestStatus.PENDING) return;

          // Approve all pending/waiting approval instances
          const instances = request.approvalInstances || [];
          for (const inst of instances) {
            if (inst.status === ApprovalInstanceStatus.PENDING || inst.status === ApprovalInstanceStatus.WAITING) {
              inst.status = ApprovalInstanceStatus.APPROVED;
              inst.decisionNote = 'System Auto-Approved (Expired after 5 days)';
              inst.actionDate = new Date();
              await em.save(inst);
            }
          }

          // Mark request as APPROVED by System Auto-Approve
          request.status = LeaveRequestStatus.APPROVED;
          request.reviewedAt = new Date();
          await em.save(request);

          // Deduct ledger balance
          await this.applyLedger(em, request, LedgerTransactionType.USAGE, request.employeeId);

          // Audit log for system auto-approval
          await this.auditService.log(
            request.employeeId,
            AuditActionType.LEAVE_REQUEST_APPROVED,
            'LeaveRequest',
            request.id,
            { newValues: request, reason: 'Auto-approved by system (5-day expiration rule)' },
            em,
          );

          autoApprovedIds.push(request.id);
        });
      } catch (e) {
        // Continue processing remaining expired requests if one fails
      }
    }

    return { processedCount: autoApprovedIds.length, autoApprovedIds };
  }
}
