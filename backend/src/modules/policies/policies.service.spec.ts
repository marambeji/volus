/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { LeavePolicy } from './entities/leave-policy.entity';
import { LeaveRule } from './entities/leave-rule.entity';
import { SeniorityMilestone } from './entities/seniority-milestone.entity';
import { Country } from '../countries/entities/country.entity';
import { Division } from '../divisions/entities/division.entity';
import { ApprovalWorkflow } from '../approval-workflows/entities/approval-workflow.entity';
import { LeaveType } from '../leave-types/entities/leave-type.entity';
import { AccrualInterval, CutOffType, ResetType } from '../../common/enums';

describe('PoliciesService (Unit Tasks)', () => {
  let service: PoliciesService;

  beforeEach(async () => {
    const mockRepo = {};
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoliciesService,
        { provide: getRepositoryToken(LeavePolicy), useValue: mockRepo },
        { provide: getRepositoryToken(LeaveRule), useValue: mockRepo },
        { provide: getRepositoryToken(SeniorityMilestone), useValue: mockRepo },
        { provide: getRepositoryToken(Country), useValue: mockRepo },
        { provide: getRepositoryToken(Division), useValue: mockRepo },
        { provide: getRepositoryToken(ApprovalWorkflow), useValue: mockRepo },
        { provide: getRepositoryToken(LeaveType), useValue: mockRepo },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PoliciesService>(PoliciesService);
  });

  describe('validateMilestones', () => {
    it('should pass on valid continuous milestones', () => {
      const milestones = [
        { serviceYearsFrom: 0, serviceYearsTo: 2, accrualRate: 1 },
        { serviceYearsFrom: 2, serviceYearsTo: 5, accrualRate: 1.5 },
        { serviceYearsFrom: 5, serviceYearsTo: undefined, accrualRate: 2 },
      ];
      expect(() =>
        (service as any).validateMilestones(milestones),
      ).not.toThrow();
    });

    it('should throw error when serviceYearsTo <= serviceYearsFrom', () => {
      const milestones = [
        { serviceYearsFrom: 2, serviceYearsTo: 2, accrualRate: 1 },
      ];
      expect(() => (service as any).validateMilestones(milestones)).toThrow(
        BadRequestException,
      );
    });

    it('should throw error on gap or non-continuity between milestones', () => {
      const milestones = [
        { serviceYearsFrom: 0, serviceYearsTo: 2, accrualRate: 1 },
        { serviceYearsFrom: 3, serviceYearsTo: 5, accrualRate: 1.5 },
      ];
      expect(() => (service as any).validateMilestones(milestones)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('normalizeRule', () => {
    it('should clean/nullify accrual fields when isAccrued is false', () => {
      const inputRule = {
        leaveType: 'annual',
        isAccrued: false,
        accrualInterval: AccrualInterval.MONTHLY,
        accrualRate: 1.25,
        cutOffType: CutOffType.HIRE_DATE,
        resetType: ResetType.NONE,
        carryOverEnabled: false,
      };

      const result = (service as any).normalizeRule(inputRule);
      expect(result.accrualInterval).toBeNull();
      expect(result.accrualRate).toBeNull();
    });

    it('should keep accrual fields when isAccrued is true', () => {
      const inputRule = {
        leaveType: 'annual',
        isAccrued: true,
        accrualInterval: AccrualInterval.YEARLY,
        accrualRate: 10,
        cutOffType: CutOffType.HIRE_DATE,
        resetType: ResetType.NONE,
        carryOverEnabled: false,
      };

      const result = (service as any).normalizeRule(inputRule);
      expect(result.accrualInterval).toBe(AccrualInterval.YEARLY);
      expect(result.accrualRate).toBe(10);
    });

    it('should clean/nullify carry over fields when carryOverEnabled is false', () => {
      const inputRule = {
        leaveType: 'annual',
        isAccrued: false,
        cutOffType: CutOffType.HIRE_DATE,
        resetType: ResetType.NONE,
        carryOverEnabled: false,
        maxCarryOver: 5,
        carryOverExpirationEnabled: true,
        carryOverExpirationDays: 90,
      };

      const result = (service as any).normalizeRule(inputRule);
      expect(result.maxCarryOver).toBeNull();
      expect(result.carryOverExpirationEnabled).toBe(false);
      expect(result.carryOverExpirationDays).toBeNull();
    });
  });

  describe('serializePolicy', () => {
    it('should format policies, rules, and milestones to the frontend schema', () => {
      const mockPolicy = {
        id: 'policy-id',
        policyName: 'Test Policy',
        country: { name: 'Lebanon', code: 'LB', flag: '🇱🇧' },
        weekendDays: [5, 6],
        workingHoursPerDay: 8,
        approvalWorkflow: { id: 'wf-id' },
        divisions: [{ name: 'Levant' }, { name: 'Gulf' }],
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        rules: [
          {
            leaveType: { key: 'annual' },
            entitlementDays: 15,
            isAccrued: true,
            accrualInterval: AccrualInterval.MONTHLY,
            accrualRate: 1.25,
            cutOffType: CutOffType.HIRE_DATE,
            resetType: ResetType.NONE,
            carryOverEnabled: true,
            maxCarryOver: 10,
            carryOverExpirationEnabled: true,
            carryOverExpirationDays: 90,
            maxConsecutive: 5,
            minNoticeDays: 2,
            maxBalanceCap: 30,
            waitingPeriodDays: 30,
            milestones: [
              {
                serviceYearsFrom: 0,
                serviceYearsTo: 2,
                accrualRate: 1.25,
                entitlementDays: 15,
                cap: 30,
              },
            ],
          },
        ],
      } as any as LeavePolicy;

      const result = (service as any).serializePolicy(mockPolicy);
      expect(result.id).toBe('policy-id');
      expect(result.countryCode).toBe('LB');
      expect(result.divisionAssignment).toBe('Levant, Gulf');
      expect(result.leaveQuotas[0].leaveType).toBe('annual');
      expect(
        result.leaveQuotas[0].seniorityMilestones[0].serviceYearsFrom,
      ).toBe(0);
    });
  });
});
