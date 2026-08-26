import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequest } from './entities/leave-request.entity';
import { ApprovalInstance } from './entities/approval-instance.entity';
import { Employee } from '../employees/entities/employee.entity';
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
  DayPortion,
} from '../../common/enums';
import { LeaveRule } from '../policies/entities/leave-rule.entity';
import { BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';

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
  let requestRepo: { find: jest.Mock };

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

    requestRepo = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: getRepositoryToken(LeaveRequest), useValue: requestRepo },
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

  it('7. processExpiredRequests auto-approves overdue PENDING requests as system (no per-actor auth)', async () => {
    const step = {
      id: 'step-1',
      requestId: mockRequestId,
      stepOrder: 1,
      approverType: ApproverType.MANAGER,
      resolvedApproverId: mockManagerId,
      status: ApprovalInstanceStatus.PENDING,
      decisionNote: '',
      step: { isRequired: true },
    };
    mockLeaveRequest.approvalInstances = [step];
    requestRepo.find.mockResolvedValue([mockLeaveRequest]);

    const result = await service.processExpiredRequests();

    expect(step.status).toBe(ApprovalInstanceStatus.APPROVED);
    expect(step.decisionNote).toMatch(/Auto-approved/);
    expect(mockLeaveRequest.status).toBe(LeaveRequestStatus.APPROVED);
    expect(mockLeaveRequest.reviewerId).toBeNull();
    expect((service as any).applyLedger).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ processedCount: 1, autoApprovedIds: [mockRequestId] });
  });

  it('8. hrDelete requires a non-empty reason', async () => {
    await expect(service.hrDelete(mockRequestId, mockHrId, '')).rejects.toThrow(BadRequestException);
  });

  it('9. hrDelete sets DELETED_BY_HR + reason regardless of status, and reverses ledger only if it was APPROVED', async () => {
    mockLeaveRequest.status = LeaveRequestStatus.APPROVED;
    mockLeaveRequest.approvalInstances = [];

    await service.hrDelete(mockRequestId, mockHrId, 'Duplicate submission');

    expect(mockLeaveRequest.status).toBe(LeaveRequestStatus.DELETED_BY_HR);
    expect(mockLeaveRequest.deletionReason).toBe('Duplicate submission');
    expect(mockLeaveRequest.deletedById).toBe(mockHrId);
    expect((service as any).applyLedger).toHaveBeenCalledWith(
      mockEm,
      mockLeaveRequest,
      LedgerTransactionType.REVERSAL,
      mockHrId,
    );
  });

  it('10. hrDelete on a PENDING request does not touch the ledger', async () => {
    mockLeaveRequest.status = LeaveRequestStatus.PENDING;
    mockLeaveRequest.approvalInstances = [];

    await service.hrDelete(mockRequestId, mockHrId, 'Requested by employee via email');

    expect(mockLeaveRequest.status).toBe(LeaveRequestStatus.DELETED_BY_HR);
    expect((service as any).applyLedger).not.toHaveBeenCalled();
  });
});

describe('LeaveRequestsService.getTeamAvailability', () => {
  let service: LeaveRequestsService;
  let requestRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let employeeRepo: { findOne: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    requestRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    employeeRepo = { findOne: jest.fn(), find: jest.fn() };

    const dataSource = {
      getRepository: jest.fn().mockImplementation((entity: any) =>
        entity === Employee ? employeeRepo : requestRepo,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: getRepositoryToken(LeaveRequest), useValue: requestRepo },
        { provide: getRepositoryToken(ApprovalInstance), useValue: {} },
        { provide: LeaveBalancesService, useValue: {} },
        { provide: ApprovalWorkflowsService, useValue: {} },
        { provide: AuditLogsService, useValue: { log: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<LeaveRequestsService>(LeaveRequestsService);
  });

  it('rejects a caller who is neither the requester\'s manager nor HR', async () => {
    requestRepo.findOne.mockResolvedValue({
      id: 'req1',
      employeeId: 'emp1',
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      employee: { id: 'emp1', managerId: 'mgr1' },
    });
    employeeRepo.findOne.mockResolvedValue({ id: 'stranger', role: EmployeeRole.EMPLOYEE });

    await expect(service.getTeamAvailability('req1', 'stranger')).rejects.toThrow(ForbiddenException);
  });

  it('computes team impact from overlapping teammate requests, including the requester', async () => {
    const request = {
      id: 'req1',
      employeeId: 'emp1',
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      employee: { id: 'emp1', managerId: 'mgr1' },
    };
    requestRepo.findOne.mockResolvedValue(request);
    employeeRepo.findOne.mockResolvedValue({ id: 'mgr1', role: EmployeeRole.MANAGER });

    const team = [
      { id: 'emp1', fullName: 'Requester', department: 'Eng' },
      { id: 'emp2', fullName: 'Teammate 2', department: 'Eng' },
      { id: 'emp3', fullName: 'Teammate 3', department: 'Eng' },
      { id: 'emp4', fullName: 'Teammate 4', department: 'Eng' },
      { id: 'emp5', fullName: 'Teammate 5', department: 'Eng' },
    ];
    employeeRepo.find.mockResolvedValue(team);

    const overlapping = [
      { id: 'req1', employeeId: 'emp1', startDate: '2026-08-10', endDate: '2026-08-12', durationDays: 3, status: 'PENDING', leaveType: { label: 'Annual Leave' } },
      { id: 'reqX', employeeId: 'emp2', startDate: '2026-08-11', endDate: '2026-08-11', durationDays: 1, status: 'APPROVED', leaveType: { label: 'Sick Leave' } },
      { id: 'reqY', employeeId: 'emp3', startDate: '2026-08-09', endDate: '2026-08-10', durationDays: 2, status: 'APPROVED', leaveType: { label: 'Annual Leave' } },
    ];
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(overlapping),
    };
    requestRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getTeamAvailability('req1', 'mgr1');

    expect(result.teamSize).toBe(5);
    expect(result.impactCount).toBe(3); // emp1 (self, pending), emp2, emp3
    expect(result.impactPercent).toBe(60);
    expect(result.members.find((m: any) => m.employeeId === 'emp1')?.isRequester).toBe(true);
    expect(result.members.find((m: any) => m.employeeId === 'emp4')?.onLeaveDuringPeriod).toBe(false);
  });
});

describe('LeaveRequestsService.getCalendarData', () => {
  let service: LeaveRequestsService;
  let requestRepo: { find: jest.Mock };
  let employeeRepo: { findOne: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    requestRepo = { find: jest.fn().mockResolvedValue([]) };
    employeeRepo = { findOne: jest.fn(), find: jest.fn() };

    const dataSource = {
      getRepository: jest.fn().mockImplementation((entity: any) =>
        entity === Employee ? employeeRepo : requestRepo,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: getRepositoryToken(LeaveRequest), useValue: requestRepo },
        { provide: getRepositoryToken(ApprovalInstance), useValue: {} },
        { provide: LeaveBalancesService, useValue: {} },
        { provide: ApprovalWorkflowsService, useValue: {} },
        { provide: AuditLogsService, useValue: { log: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<LeaveRequestsService>(LeaveRequestsService);
  });

  it('forces EMPLOYEE role to SELF scope', async () => {
    const self = { id: 'emp1', role: EmployeeRole.EMPLOYEE, department: 'Sales', managerId: 'mgr1' };
    employeeRepo.findOne.mockResolvedValue(self);
    employeeRepo.find.mockResolvedValueOnce([self]); // final scoped employees lookup

    const result = await service.getCalendarData('emp1');

    expect(result.scope).toBe('self');
    expect(result.employees.map((e: any) => e.id)).toEqual(['emp1']);
  });

  it('scopes MANAGER to TEAM (direct reports plus their own manager, not dept peers)', async () => {
    const manager = { id: 'mgr1', role: EmployeeRole.MANAGER, department: 'Engineering', managerId: 'boss1' };
    const directReports = [
      { id: 'dr1', department: 'Engineering' },
      { id: 'dr2', department: 'Sales' },
    ];
    const finalScoped = [{ id: 'dr1' }, { id: 'dr2' }, { id: 'boss1' }];
    employeeRepo.findOne.mockResolvedValue(manager);
    employeeRepo.find
      .mockResolvedValueOnce(directReports) // directReports query
      .mockResolvedValueOnce(finalScoped);  // final scoped employees lookup

    const result = await service.getCalendarData('mgr1');

    expect(result.scope).toBe('team');
    expect(result.employees.map((e: any) => e.id).sort()).toEqual(['boss1', 'dr1', 'dr2']);
  });

  it('gives HR_ADMIN the ALL scope (every active employee)', async () => {
    const admin = { id: 'hr1', role: EmployeeRole.HR_ADMIN, department: 'HR' };
    const everyone = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];
    employeeRepo.findOne.mockResolvedValue(admin);
    employeeRepo.find
      .mockResolvedValueOnce(everyone) // all-active query
      .mockResolvedValueOnce(everyone); // final scoped employees lookup

    const result = await service.getCalendarData('hr1');

    expect(result.scope).toBe('all');
    expect(result.employees).toHaveLength(3);
  });
});

describe('LeaveRequestsService - validateDayPortion', () => {
  let service: LeaveRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: getRepositoryToken(LeaveRequest), useValue: {} },
        { provide: getRepositoryToken(ApprovalInstance), useValue: {} },
        { provide: LeaveBalancesService, useValue: {} },
        { provide: ApprovalWorkflowsService, useValue: {} },
        { provide: AuditLogsService, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<LeaveRequestsService>(LeaveRequestsService);
  });

  const baseDto = {
    startDate: '2026-09-10',
    endDate: '2026-09-10',
    durationDays: 0.5,
  };
  const allowingRule = { allowsHalfDay: true } as LeaveRule;
  const forbiddingRule = { allowsHalfDay: false } as LeaveRule;

  it('defaults to FULL_DAY when dayPortion is omitted, regardless of the rule', () => {
    const result = (service as any).validateDayPortion(
      { startDate: '2026-09-10', endDate: '2026-09-12', durationDays: 3 },
      forbiddingRule,
    );
    expect(result).toBe(DayPortion.FULL_DAY);
  });

  it('accepts FIRST_HALF for a single 0.5-day request when the rule allows half days', () => {
    const result = (service as any).validateDayPortion(
      { ...baseDto, dayPortion: DayPortion.FIRST_HALF },
      allowingRule,
    );
    expect(result).toBe(DayPortion.FIRST_HALF);
  });

  it('accepts SECOND_HALF for a single 0.5-day request when the rule allows half days', () => {
    const result = (service as any).validateDayPortion(
      { ...baseDto, dayPortion: DayPortion.SECOND_HALF },
      allowingRule,
    );
    expect(result).toBe(DayPortion.SECOND_HALF);
  });

  it('rejects a half-day portion spanning more than one day', () => {
    expect(() =>
      (service as any).validateDayPortion(
        { startDate: '2026-09-10', endDate: '2026-09-11', durationDays: 0.5, dayPortion: DayPortion.FIRST_HALF },
        allowingRule,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a half-day portion when durationDays is not 0.5', () => {
    expect(() =>
      (service as any).validateDayPortion(
        { ...baseDto, durationDays: 1, dayPortion: DayPortion.FIRST_HALF },
        allowingRule,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a half-day portion when the leave rule does not allow half days', () => {
    expect(() =>
      (service as any).validateDayPortion(
        { ...baseDto, dayPortion: DayPortion.SECOND_HALF },
        forbiddingRule,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a half-day portion when no leave rule was resolved', () => {
    expect(() =>
      (service as any).validateDayPortion(
        { ...baseDto, dayPortion: DayPortion.FIRST_HALF },
        null,
      ),
    ).toThrow(BadRequestException);
  });
});
