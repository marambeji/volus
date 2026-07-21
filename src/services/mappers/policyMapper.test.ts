import { describe, it, expect } from 'vitest';
import {
  frontendQuotaToRuleDto,
  policyResponseToFrontendPolicy,
  BackendCutOffType,
  BackendResetType,
  BackendAccrualInterval,
} from './policyMapper';
import type { LeaveQuota } from '../../admin/types/adminTypes';

describe('policyMapper', () => {
  it('maps LeaveQuota to BackendLeaveRuleDto retaining leaveTypeId and all 19 configuration fields', () => {
    const quota: LeaveQuota = {
      leaveTypeId: 'uuid-annual-123',
      leaveType: 'annual',
      entitlementDays: 25,
      isAccrued: true,
      accrualInterval: 'monthly',
      accrualRate: 2.08,
      carryOverEnabled: true,
      maxCarryOver: 5,
      maxConsecutiveDays: 15,
      minNoticeDays: 2,
      maxBalanceCap: 50,
      waitingPeriodDays: 30,
      allowsHalfDay: true,
      requiresNote: false,
      requiresDocument: false,
      requiresPositiveBalance: true,
      minRequestDays: 0.5,
      maxRequestDays: 20,
      allowedCountries: ['LB', 'FR'],
    };

    const dto = frontendQuotaToRuleDto(quota);

    expect(dto.leaveTypeId).toBe('uuid-annual-123');
    expect(dto.leaveType).toBe('uuid-annual-123');
    expect(dto.entitlementDays).toBe(25);
    expect(dto.isAccrued).toBe(true);
    expect(dto.accrualInterval).toBe(BackendAccrualInterval.MONTHLY);
    expect(dto.accrualRate).toBe(2.08);
    expect(dto.maxConsecutiveDays).toBe(15);
    expect(dto.allowsHalfDay).toBe(true);
    expect(dto.requiresNote).toBe(false);
    expect(dto.requiresDocument).toBe(false);
    expect(dto.requiresPositiveBalance).toBe(true);
    expect(dto.minRequestDays).toBe(0.5);
    expect(dto.maxRequestDays).toBe(20);
    expect(dto.allowedCountries).toEqual(['LB', 'FR']);
  });

  it('parses BackendPolicyResponse into distinct LeaveQuota objects for Annual, Sick, and Unpaid', () => {
    const backendRes = {
      id: 'pol-1',
      policyName: 'Test Policy',
      weekendDays: [0, 6],
      workingHoursPerDay: 8,
      leaveQuotas: [
        {
          leaveTypeId: 'lt-annual-id',
          leaveType: 'annual',
          entitlementDays: 25,
          isAccrued: true,
          accrualInterval: BackendAccrualInterval.MONTHLY,
          accrualRate: 2.08,
          carryOverEnabled: true,
          maxCarryOver: 5,
          maxConsecutiveDays: 15,
          allowsHalfDay: true,
          requiresNote: false,
          requiresDocument: false,
          requiresPositiveBalance: true,
          minRequestDays: 0.5,
        },
        {
          leaveTypeId: 'lt-sick-id',
          leaveType: 'sick',
          entitlementDays: 10,
          isAccrued: false,
          carryOverEnabled: false,
          maxCarryOver: 0,
          maxConsecutiveDays: 5,
          allowsHalfDay: false,
          requiresNote: true,
          requiresDocument: true,
          requiresPositiveBalance: false,
          minRequestDays: 1,
        },
        {
          leaveTypeId: 'lt-unpaid-id',
          leaveType: 'unpaid',
          entitlementDays: 30,
          isAccrued: false,
          carryOverEnabled: false,
          maxCarryOver: 0,
          maxConsecutiveDays: 30,
          allowsHalfDay: true,
          requiresNote: true,
          requiresDocument: false,
          requiresPositiveBalance: false,
          minRequestDays: 1,
        },
      ],
    };

    const frontendPolicy = policyResponseToFrontendPolicy(backendRes as any);

    expect(frontendPolicy.leaveQuotas).toHaveLength(3);

    const annual = frontendPolicy.leaveQuotas.find((q) => q.leaveTypeId === 'lt-annual-id');
    const sick = frontendPolicy.leaveQuotas.find((q) => q.leaveTypeId === 'lt-sick-id');
    const unpaid = frontendPolicy.leaveQuotas.find((q) => q.leaveTypeId === 'lt-unpaid-id');

    expect(annual).toBeDefined();
    expect(sick).toBeDefined();
    expect(unpaid).toBeDefined();

    // Verify distinct configurations
    expect(annual?.entitlementDays).toBe(25);
    expect(annual?.isAccrued).toBe(true);
    expect(annual?.allowsHalfDay).toBe(true);
    expect(annual?.requiresPositiveBalance).toBe(true);

    expect(sick?.entitlementDays).toBe(10);
    expect(sick?.isAccrued).toBe(false);
    expect(sick?.requiresDocument).toBe(true);
    expect(sick?.requiresPositiveBalance).toBe(false);

    expect(unpaid?.entitlementDays).toBe(30);
    expect(unpaid?.requiresPositiveBalance).toBe(false);
    expect(unpaid?.requiresDocument).toBe(false);
  });
});
