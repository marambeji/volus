import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequest } from './entities/leave-request.entity';
import { ApprovalInstance } from './entities/approval-instance.entity';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';
import { ApprovalWorkflowsService } from '../approval-workflows/approval-workflows.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DataSource } from 'typeorm';
import {
  ApprovalInstanceStatus,
  ApproverType,
  EmployeeRole,
  LeaveRequestStatus,
  LedgerTransactionType,
} from '../../common/enums';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('LeaveRequestsService - Sequential Approval Authorization & Multi-Level Workflows', () => {
  let service: LeaveRequestsService;

  const mockManagerId = 'mgr-uuid-1111';
  const mockMgrMgrId = 'mgrmgr-uuid-1112';
  const mockSpecificPersonId = 'specific-uuid-1113';
  const mockHrId = 'hr-uuid-2222';
  const mockRequestId = 'req-uuid-3333';
  const mockEmpId = 'emp-uuid-9999';

  let mockLeaveRequest: any;
  let mockEm: any;

  beforeEach(async () => {
    mockLeaveRequest = {
      id: mockRequestId,
      employeeId: mockEmpId,
      leaveTypeId: 'lt-uuid-8888',
      status: LeaveRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      approvalInstances: [],
    };

    const usersMap: Record<string, any> = {
      [mockManagerId]: { id: mockManagerId, role: EmployeeRole.EMPLOYEE },
      [mockMgrMgrId]: { id: mockMgrMgrId, role: EmployeeRole.EMPLOYEE },
      [mockSpecificPersonId]: { id: mockSpecificPersonId, role: EmployeeRole.EMPLOYEE },
      [mockHrId]: { id: mockHrId, role: EmployeeRole.HR_ADMIN },
      [mockEmpId]: { id: mockEmpId, role: EmployeeRole.EMPLOYEE },
    };

    mockEm = {
      findOne: jest.fn().mockImplementation((entity, options) => {
        if (entity === LeaveRequest || entity.name === 'LeaveRequest') {
          return Promise.resolve(mockLeaveRequest);
        }
        if (entity.name === 'Employee' || entity.constructor?.name === 'Employee') {
          const id = options?.where?.id;
          return Promise.resolve(usersMap[id] || null);
        }
        return Promise.resolve(null);
      }),
      save: jest.fn().mockImplementation((item) => Promise.resolve(item)),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockEm)),
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockImplementation((options) => {
          const id = options?.where?.id;
          if (id === mockRequestId) return Promise.resolve(mockLeaveRequest);
          return Promise.resolve(usersMap[id] || null);
        }),
        find: jest.fn().mockReturnValue(Promise.resolve([mockLeaveRequest])),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: getRepositoryToken(LeaveRequest), useValue: {} },
        { provide: getRepositoryToken(ApprovalInstance), useValue: {} },
        {
          provide: LeaveBalancesService,
          useValue: { calculateBalancesForEmployee: jest.fn().mockResolvedValue({ balances: [{ leaveTypeId: 'lt-uuid-8888' }] }) },
        },
        { provide: ApprovalWorkflowsService, useValue: {} },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<LeaveRequestsService>(LeaveRequestsService);
    jest.spyOn(service as any, 'applyLedger').mockResolvedValue({});
  });

  it('1. One-level HR workflow: HR = PENDING, HR approval finalizes request with 1 USAGE', async () => {
    const hrStep = {
      id: 'step-1',
      requestId: mockRequestId,
      stepOrder: 1,
      approverType: ApproverType.HR,
      resolvedApproverId: null,
      status: ApprovalInstanceStatus.PENDING,
      step: { isRequired: true },
    };
    mockLeaveRequest.approvalInstances = [hrStep];

    await service.approveStep(mockRequestId, mockHrId, 'HR Approved');

    expect(hrStep.status).toBe(ApprovalInstanceStatus.APPROVED);
    expect(mockLeaveRequest.status).toBe(LeaveRequestStatus.APPROVED);
    expect((service as any).applyLedger).toHaveBeenCalledTimes(1);
  });

  it('2. Two-level workflow (Manager -> HR): Early HR attempt blocked, Manager approval activates HR with 0 USAGE, final HR approval produces 1 USAGE', async () => {
    const mgrStep = {
      id: 'step-1',
      requestId: mockRequestId,
      stepOrder: 1,
      approverType: ApproverType.MANAGER,
      resolvedApproverId: mockManagerId,
      status: ApprovalInstanceStatus.PENDING,
      step: { isRequired: true },
    };
    const hrStep = {
      id: 'step-2',
      requestId: mockRequestId,
      stepOrder: 2,
      approverType: ApproverType.HR,
      resolvedApproverId: null,
      status: ApprovalInstanceStatus.WAITING,
      step: { isRequired: true },
    };
    mockLeaveRequest.approvalInstances = [mgrStep, hrStep];

    // Early HR approval attempt blocked (ForbiddenException 403)
    await expect(service.approveStep(mockRequestId, mockHrId, 'Early HR')).rejects.toThrow(ForbiddenException);

    // Level 1 Manager approves
    await service.approveStep(mockRequestId, mockManagerId, 'Manager approved');
    expect(mgrStep.status).toBe(ApprovalInstanceStatus.APPROVED);
    expect(hrStep.status).toBe(ApprovalInstanceStatus.PENDING);
    expect(mockLeaveRequest.status).toBe(LeaveRequestStatus.PENDING);
    expect((service as any).applyLedger).not.toHaveBeenCalled();

    // Level 2 HR approves
    await service.approveStep(mockRequestId, mockHrId, 'HR final approved');
    expect(hrStep.status).toBe(ApprovalInstanceStatus.APPROVED);
    expect(mockLeaveRequest.status).toBe(LeaveRequestStatus.APPROVED);
    expect((service as any).applyLedger).toHaveBeenCalledTimes(1);
  });

  it('3. Three-level workflow (Manager -> Manager’s Manager -> HR): Sequential activation and single USAGE on final step', async () => {
    const mgrStep = {
      id: 'step-1',
      requestId: mockRequestId,
      stepOrder: 1,
      approverType: ApproverType.MANAGER,
      resolvedApproverId: mockManagerId,
      status: ApprovalInstanceStatus.PENDING,
      step: { isRequired: true },
    };
    const mgrMgrStep = {
      id: 'step-2',
      requestId: mockRequestId,
      stepOrder: 2,
      approverType: ApproverType.MANAGERS_MANAGER,
      resolvedApproverId: mockMgrMgrId,
      status: ApprovalInstanceStatus.WAITING,
      step: { isRequired: true },
    };
    const hrStep = {
      id: 'step-3',
      requestId: mockRequestId,
      stepOrder: 3,
      approverType: ApproverType.HR,
      resolvedApproverId: null,
      status: ApprovalInstanceStatus.WAITING,
      step: { isRequired: true },
    };
    mockLeaveRequest.approvalInstances = [mgrStep, mgrMgrStep, hrStep];

    // Level 2 and Level 3 early attempts blocked (ForbiddenException)
    await expect(service.approveStep(mockRequestId, mockMgrMgrId, 'Early Level 2')).rejects.toThrow(ForbiddenException);
    await expect(service.approveStep(mockRequestId, mockHrId, 'Early Level 3')).rejects.toThrow(ForbiddenException);

    // Level 1 approves -> Level 2 PENDING
    await service.approveStep(mockRequestId, mockManagerId, 'L1 Approved');
    expect(mgrStep.status).toBe(ApprovalInstanceStatus.APPROVED);
    expect(mgrMgrStep.status).toBe(ApprovalInstanceStatus.PENDING);
    expect(hrStep.status).toBe(ApprovalInstanceStatus.WAITING);
    expect(mockLeaveRequest.status).toBe(LeaveRequestStatus.PENDING);
    expect((service as any).applyLedger).not.toHaveBeenCalled();

    // Level 3 attempt still blocked
    await expect(service.approveStep(mockRequestId, mockHrId, 'Level 3 Early')).rejects.toThrow(ForbiddenException);

    // Level 2 approves -> Level 3 PENDING
    await service.approveStep(mockRequestId, mockMgrMgrId, 'L2 Approved');
    expect(mgrMgrStep.status).toBe(ApprovalInstanceStatus.APPROVED);
    expect(hrStep.status).toBe(ApprovalInstanceStatus.PENDING);
    expect(mockLeaveRequest.status).toBe(LeaveRequestStatus.PENDING);
    expect((service as any).applyLedger).not.toHaveBeenCalled();

    // Level 3 approves -> Request APPROVED and 1 USAGE created
    await service.approveStep(mockRequestId, mockHrId, 'L3 Approved');
    expect(hrStep.status).toBe(ApprovalInstanceStatus.APPROVED);
    expect(mockLeaveRequest.status).toBe(LeaveRequestStatus.APPROVED);
    expect((service as any).applyLedger).toHaveBeenCalledTimes(1);
  });

  it('4. SPECIFIC_PERSON approver type: Only the resolved specific approver may act', async () => {
    const specStep = {
      id: 'step-1',
      requestId: mockRequestId,
      stepOrder: 1,
      approverType: ApproverType.SPECIFIC_PERSON,
      resolvedApproverId: mockSpecificPersonId,
      status: ApprovalInstanceStatus.PENDING,
      step: { isRequired: true },
    };
    mockLeaveRequest.approvalInstances = [specStep];

    // Unauthorized manager attempt blocked
    await expect(service.approveStep(mockRequestId, mockManagerId, 'Wrong user')).rejects.toThrow(ForbiddenException);

    // Resolved specific person succeeds
    await service.approveStep(mockRequestId, mockSpecificPersonId, 'Specific Approved');
    expect(specStep.status).toBe(ApprovalInstanceStatus.APPROVED);
  });

  it('5. Rejection at Level 1 marks active step REJECTED, future steps SKIPPED, request REJECTED with 0 USAGE', async () => {
    const step1 = {
      id: 'step-1',
      requestId: mockRequestId,
      stepOrder: 1,
      approverType: ApproverType.MANAGER,
      resolvedApproverId: mockManagerId,
      status: ApprovalInstanceStatus.PENDING,
      step: { isRequired: true },
    };
    const step2 = {
      id: 'step-2',
      requestId: mockRequestId,
      stepOrder: 2,
      approverType: ApproverType.HR,
      resolvedApproverId: null,
      status: ApprovalInstanceStatus.WAITING,
      step: { isRequired: true },
    };
    mockLeaveRequest.approvalInstances = [step1, step2];

    await service.rejectStep(mockRequestId, mockManagerId, 'Rejected at Level 1');

    expect(step1.status).toBe(ApprovalInstanceStatus.REJECTED);
    expect(step2.status).toBe(ApprovalInstanceStatus.SKIPPED);
    expect(mockLeaveRequest.status).toBe(LeaveRequestStatus.REJECTED);
    expect((service as any).applyLedger).not.toHaveBeenCalled();
  });

  it('6. Employee ownership check: Unowned request approval progress throws 404 Not Found', async () => {
    await expect(service.getApprovalProgress(mockRequestId, 'other-emp-id')).rejects.toThrow(NotFoundException);
  });
});
