import type { CountryPolicy, LeaveQuota, SeniorityMilestone } from '../../admin/types/adminTypes';
import type { LeaveTypeKey } from '../../types';

export const BackendAccrualInterval = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;
export type BackendAccrualInterval = (typeof BackendAccrualInterval)[keyof typeof BackendAccrualInterval];

export const BackendCutOffType = {
  FIXED_DATE: 'FIXED_DATE',
  HIRE_DATE: 'HIRE_DATE',
} as const;
export type BackendCutOffType = (typeof BackendCutOffType)[keyof typeof BackendCutOffType];

export const BackendResetType = {
  NONE: 'NONE',
  YEARLY: 'YEARLY',
  POLICY_CUTOFF: 'POLICY_CUTOFF',
} as const;
export type BackendResetType = (typeof BackendResetType)[keyof typeof BackendResetType];

export const BackendLeavePolicyStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type BackendLeavePolicyStatus = (typeof BackendLeavePolicyStatus)[keyof typeof BackendLeavePolicyStatus];

export interface BackendMilestoneDto {
  serviceYearsFrom: number;
  serviceYearsTo?: number | null;
  accrualRate: number;
  entitlementDays?: number | null;
  cap?: number | null;
}

export interface BackendLeaveRuleDto {
  leaveType: string;
  entitlementDays?: number | null;
  isAccrued: boolean;
  accrualInterval?: BackendAccrualInterval | null;
  accrualRate?: number | null;
  cutOffType: BackendCutOffType;
  cutOffMonth?: number | null;
  cutOffDay?: number | null;
  resetType: BackendResetType;
  resetDaysCount?: number | null;
  carryOverEnabled: boolean;
  maxCarryOver?: number | null;
  carryOverExpirationEnabled?: boolean;
  carryOverExpirationDays?: number | null;
  maxConsecutive?: number;
  minNoticeDays?: number;
  maxBalanceCap?: number | null;
  waitingPeriodDays?: number;
  milestones?: BackendMilestoneDto[];
}

export interface CreatePolicyDto {
  policyName: string;
  countryCode: string;
  workingHoursPerDay: number;
  approvalWorkflowId: string;
  divisionAssignment?: string;
  status?: BackendLeavePolicyStatus;
  weekendDays?: number[];
  leaveQuotas?: BackendLeaveRuleDto[];
}

export interface UpdatePolicyDto {
  policyName?: string;
  countryCode?: string;
  workingHoursPerDay?: number;
  approvalWorkflowId?: string;
  divisionAssignment?: string;
  status?: BackendLeavePolicyStatus;
  weekendDays?: number[];
  leaveQuotas?: BackendLeaveRuleDto[];
}

export interface BackendPolicyResponse {
  id: string;
  policyName: string;
  country?: string;
  countryCode?: string;
  flag?: string;
  weekendDays: number[];
  workingHoursPerDay: number;
  approvalWorkflow?: string;
  divisionAssignment?: string;
  status?: BackendLeavePolicyStatus;
  createdAt?: string;
  updatedAt?: string;
  leaveQuotas?: Array<{
    leaveType: string;
    entitlementDays?: number;
    isAccrued: boolean;
    accrualInterval?: BackendAccrualInterval;
    accrualRate?: number;
    cutOffType?: BackendCutOffType;
    cutOffMonth?: number;
    cutOffDay?: number;
    resetType?: BackendResetType;
    resetDaysCount?: number;
    carryOverEnabled: boolean;
    maxCarryOver?: number;
    carryOverExpirationEnabled?: boolean;
    carryOverExpirationDays?: number;
    maxConsecutive?: number;
    minNoticeDays?: number;
    maxBalanceCap?: number;
    waitingPeriodDays?: number;
    seniorityMilestones?: Array<{
      serviceYearsFrom: number;
      serviceYearsTo?: number;
      accrualRate: number;
      entitlementDays?: number;
      cap?: number;
    }>;
  }>;
}

export function frontendQuotaToRuleDto(q: LeaveQuota): BackendLeaveRuleDto {
  const isAccrued = Boolean(q.isAccrued);
  const accrualInterval = isAccrued
    ? q.accrualInterval === 'yearly'
      ? BackendAccrualInterval.YEARLY
      : BackendAccrualInterval.MONTHLY
    : null;
  const accrualRate = isAccrued ? (q.accrualRate && q.accrualRate > 0 ? Number(q.accrualRate) : 1) : null;

  const isCustomCutOff = Boolean(q.isCutOffDifferentFromHireDate && q.cutOffDate);
  let cutOffMonth: number | null = null;
  let cutOffDay: number | null = null;

  if (isCustomCutOff && q.cutOffDate) {
    const parts = q.cutOffDate.split('-');
    if (parts.length >= 2) {
      cutOffMonth = parseInt(parts[0], 10) || 1;
      cutOffDay = parseInt(parts[1], 10) || 1;
    }
  }

  const cutOffType = isCustomCutOff ? BackendCutOffType.FIXED_DATE : BackendCutOffType.HIRE_DATE;
  const resetType = isCustomCutOff ? BackendResetType.POLICY_CUTOFF : BackendResetType.NONE;

  const carryOverEnabled = Boolean(q.carryOverEnabled);
  const maxCarryOver = carryOverEnabled ? Number(q.maxCarryOver || 0) : null;
  const carryOverExpirationEnabled = Boolean(carryOverEnabled && q.carryOverExpiration);
  const carryOverExpirationDays = carryOverExpirationEnabled ? 90 : null;

  const milestones: BackendMilestoneDto[] = (q.seniorityMilestones || []).map((m) => ({
    serviceYearsFrom: Number(m.years || 0),
    serviceYearsTo: null,
    accrualRate: Number(m.accruedDays || 0) > 0 ? Number(m.accruedDays) : 1,
    entitlementDays: Number(m.accruedDays || 0),
    cap: null,
  }));

  return {
    leaveType: q.leaveType,
    entitlementDays: q.entitlementDays !== undefined ? Number(q.entitlementDays) : 10,
    isAccrued,
    accrualInterval,
    accrualRate,
    cutOffType,
    cutOffMonth: cutOffType === BackendCutOffType.FIXED_DATE ? cutOffMonth : null,
    cutOffDay: cutOffType === BackendCutOffType.FIXED_DATE ? cutOffDay : null,
    resetType,
    resetDaysCount: q.resetDaysCount !== undefined ? Number(q.resetDaysCount) : 0,
    carryOverEnabled,
    maxCarryOver,
    carryOverExpirationEnabled,
    carryOverExpirationDays,
    maxConsecutive: q.maxConsecutive !== undefined ? Number(q.maxConsecutive) : 10,
    minNoticeDays: q.minNoticeDays !== undefined ? Number(q.minNoticeDays) : 0,
    maxBalanceCap: q.maxBalanceCap !== undefined && q.maxBalanceCap !== null ? Number(q.maxBalanceCap) : null,
    waitingPeriodDays: q.waitingPeriodDays !== undefined ? Number(q.waitingPeriodDays) : 0,
    milestones: milestones.length > 0 ? milestones : undefined,
  };
}

export function frontendPolicyToCreateDto(policy: Partial<CountryPolicy>): CreatePolicyDto {
  if (!policy.policyName || !policy.countryCode || !policy.approvalWorkflow) {
    throw new Error('policyName, countryCode, and approvalWorkflow are required');
  }

  return {
    policyName: policy.policyName.trim(),
    countryCode: policy.countryCode.trim(),
    workingHoursPerDay: Number(policy.workingHoursPerDay || 8),
    approvalWorkflowId: policy.approvalWorkflow,
    divisionAssignment: policy.divisionAssignment?.trim() || undefined,
    status: BackendLeavePolicyStatus.ACTIVE,
    weekendDays: policy.weekendDays || [0, 6],
    leaveQuotas: (policy.leaveQuotas || []).map(frontendQuotaToRuleDto),
  };
}

export function frontendPolicyToUpdateDto(policy: Partial<CountryPolicy>): UpdatePolicyDto {
  return frontendPolicyToCreateDto(policy);
}

export function policyResponseToFrontendPolicy(res: BackendPolicyResponse): CountryPolicy {
  const quotas: LeaveQuota[] = (res.leaveQuotas || []).map((r) => {
    const isCustomCutOff = r.cutOffType === BackendCutOffType.FIXED_DATE;
    const cutOffDateStr =
      isCustomCutOff && r.cutOffMonth && r.cutOffDay
        ? `${String(r.cutOffMonth).padStart(2, '0')}-${String(r.cutOffDay).padStart(2, '0')}`
        : '';

    const milestones: SeniorityMilestone[] = (r.seniorityMilestones || []).map((m) => ({
      years: m.serviceYearsFrom,
      accruedDays: m.entitlementDays || m.accrualRate || 0,
    }));

    return {
      leaveType: r.leaveType as LeaveTypeKey,
      entitlementDays: r.entitlementDays ?? 0,
      isAccrued: Boolean(r.isAccrued),
      accrualRate: r.accrualRate ?? 0,
      carryOverEnabled: Boolean(r.carryOverEnabled),
      maxCarryOver: r.maxCarryOver ?? 0,
      maxConsecutive: r.maxConsecutive ?? 10,
      minNoticeDays: r.minNoticeDays ?? 0,
      accrualInterval: r.accrualInterval === BackendAccrualInterval.YEARLY ? 'yearly' : 'monthly',
      seniorityMilestones: milestones,
      isCutOffDifferentFromHireDate: isCustomCutOff,
      cutOffDate: cutOffDateStr,
      carryOverExpiration: r.carryOverExpirationEnabled ? '90 days' : '',
      maxBalanceCap: r.maxBalanceCap ?? 99,
      resetDate: cutOffDateStr || '01-01',
      resetDaysCount: r.resetDaysCount ?? 0,
      waitingPeriodDays: r.waitingPeriodDays ?? 0,
    };
  });

  return {
    id: res.id,
    policyName: res.policyName,
    country: res.country || 'Unknown',
    countryCode: res.countryCode || 'UN',
    flag: res.flag || '🏳️',
    weekendDays: res.weekendDays || [0, 6],
    workingHoursPerDay: res.workingHoursPerDay || 8,
    approvalWorkflow: res.approvalWorkflow || '',
    divisionAssignment: res.divisionAssignment || '',
    leaveQuotas: quotas,
    createdAt: res.createdAt ? res.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
    updatedAt: res.updatedAt ? res.updatedAt.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}
