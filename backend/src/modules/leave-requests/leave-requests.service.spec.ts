import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequest } from './entities/leave-request.entity';
import { ApprovalInstance } from './entities/approval-instance.entity';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';
import { ApprovalWorkflowsService } from '../approval-workflows/approval-workflows.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DataSource } from 'typeorm';

describe('LeaveRequestsService', () => {
  let service: LeaveRequestsService;

  beforeEach(async () => {
    const mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        {
          provide: getRepositoryToken(LeaveRequest),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(ApprovalInstance),
          useValue: mockRepo,
        },
        {
          provide: LeaveBalancesService,
          useValue: {
            checkBalance: jest.fn(),
          },
        },
        {
          provide: ApprovalWorkflowsService,
          useValue: {
            resolveWorkflow: jest.fn(),
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LeaveRequestsService>(LeaveRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
