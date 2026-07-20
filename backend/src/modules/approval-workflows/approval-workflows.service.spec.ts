/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ApprovalWorkflowsService } from './approval-workflows.service';
import { ApprovalWorkflow } from './entities/approval-workflow.entity';
import { ApprovalWorkflowStep } from './entities/approval-workflow-step.entity';
import { ApproverType } from '../../common/enums';

describe('ApprovalWorkflowsService (Unit Tasks)', () => {
  let service: ApprovalWorkflowsService;

  beforeEach(async () => {
    const mockRepo = {};
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalWorkflowsService,
        { provide: getRepositoryToken(ApprovalWorkflow), useValue: mockRepo },
        {
          provide: getRepositoryToken(ApprovalWorkflowStep),
          useValue: mockRepo,
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ApprovalWorkflowsService>(ApprovalWorkflowsService);
  });

  describe('validateSteps', () => {
    it('should throw BadRequestException if step orders are duplicate', () => {
      const steps = [
        { stepOrder: 1, approverType: ApproverType.MANAGER },
        { stepOrder: 1, approverType: ApproverType.HR },
      ] as any;
      expect(() => (service as any).validateSteps(steps)).toThrow(
        new BadRequestException(
          'Step orders must be unique within a workflow.',
        ),
      );
    });

    it('should throw BadRequestException if SPECIFIC_PERSON has no specificApproverId', () => {
      const steps = [
        { stepOrder: 1, approverType: ApproverType.SPECIFIC_PERSON },
      ] as any;
      expect(() => (service as any).validateSteps(steps)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if non-SPECIFIC_PERSON has specificApproverId', () => {
      const steps = [
        {
          stepOrder: 1,
          approverType: ApproverType.MANAGER,
          specificApproverId: 'some-uuid',
        },
      ] as any;
      expect(() => (service as any).validateSteps(steps)).toThrow(
        BadRequestException,
      );
    });

    it('should pass with valid step parameters', () => {
      const steps = [
        { stepOrder: 1, approverType: ApproverType.MANAGER },
        {
          stepOrder: 2,
          approverType: ApproverType.SPECIFIC_PERSON,
          specificApproverId: 'some-uuid',
        },
        { stepOrder: 3, approverType: ApproverType.HR },
      ] as any;
      expect(() => (service as any).validateSteps(steps)).not.toThrow();
    });
  });
});
