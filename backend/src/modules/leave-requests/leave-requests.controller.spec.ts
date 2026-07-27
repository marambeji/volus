import { Test, TestingModule } from '@nestjs/testing';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { DataSource } from 'typeorm';
import { AdminGuard } from '../../common/guards/admin.guard';

describe('LeaveRequestsController', () => {
  let controller: LeaveRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaveRequestsController],
      providers: [
        {
          provide: LeaveRequestsService,
          useValue: {
            create: jest.fn(),
            cancel: jest.fn(),
            getMyApprovals: jest.fn(),
            approveStep: jest.fn(),
            rejectStep: jest.fn(),
            hrFindAll: jest.fn(),
            hrApprove: jest.fn(),
            hrReject: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {},
        },
        AdminGuard,
      ],
    }).compile();

    controller = module.get<LeaveRequestsController>(LeaveRequestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
