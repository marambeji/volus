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
  leaveTypeId?: string;
  leaveType: string;
  approvalWorkflowId?: string;
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
  maxConsecutiveDays?: number | null;
  minNoticeDays?: number;
  maxBalanceCap?: number | null;
  waitingPeriodDays?: number;
  allowsHalfDay?: boolean;
  requiresNote?: boolean;
  requiresDocument?: boolean;
  requiresPositiveBalance?: boolean;
  minRequestDays?: number;
  maxRequestDays?: number | null;
  allowedCountries?: string[] | null;
  milestones?: BackendMilestoneDto[];
}

export interface CreatePolicyDto {
  policyName: string;
  countryCode: string;
  workingHoursPerDay: number;
  divisionAssignment?: string;
  status?: BackendLeavePolicyStatus;
  weekendDays?: number[];
  leaveQuotas?: BackendLeaveRuleDto[];
}

export interface UpdatePolicyDto {
  policyName?: string;
  countryCode?: string;
  workingHoursPerDay?: number;
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
  divisionAssignment?: string;
  status?: BackendLeavePolicyStatus;
  createdAt?: string;
  updatedAt?: string;
  leaveQuotas?: Array<{
    leaveTypeId?: string;
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
    maxConsecutiveDays?: number | null;
    minNoticeDays?: number;
    maxBalanceCap?: number | null;
    waitingPeriodDays?: number;
    allowsHalfDay?: boolean;
    requiresNote?: boolean;
    requiresDocument?: boolean;
    requiresPositiveBalance?: boolean;
    minRequestDays?: number;
    maxRequestDays?: number | null;
    allowedCountries?: string[] | null;
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

  const rawRate = typeof q.accrualRate === 'string'
    ? parseFloat(String(q.accrualRate).replace(',', '.'))
    : Number(q.accrualRate);
  const accrualRate = isAccrued ? (!isNaN(rawRate) && rawRate > 0 ? rawRate : 0) : null;

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

  const milestones: BackendMilestoneDto[] = (q.seniorityMilestones || [])
    .filter((m) => Number(m.accruedDays || 0) > 0)
    .map((m) => {
      const rawMsRate = typeof m.accruedDays === 'string'
        ? parseFloat(String(m.accruedDays).replace(',', '.'))
        : Number(m.accruedDays || 0);
      return {
        serviceYearsFrom: Number(m.years || 0),
        serviceYearsTo: null,
        accrualRate: rawMsRate,
        entitlementDays: rawMsRate,
        cap: null,
      };
    });

  const maxConsecutiveVal = q.maxConsecutiveDays !== undefined && q.maxConsecutiveDays !== null
    ? Number(q.maxConsecutiveDays)
    : q.maxConsecutive !== undefined
    ? Number(q.maxConsecutive)
    : 10;

  const rawTypeId = q.leaveTypeId || '';
  const rawType = q.leaveType || '';
  const cleanKey = (rawType || rawTypeId).replace(/^lt-/, '');
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawTypeId);

  return {
    leaveTypeId: isValidUuid ? rawTypeId : undefined,
    leaveType: cleanKey,
    approvalWorkflowId: q.approvalWorkflowId!,
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
    maxConsecutiveDays: maxConsecutiveVal,
    minNoticeDays: q.minNoticeDays !== undefined ? Number(q.minNoticeDays) : 0,
    maxBalanceCap: q.maxBalanceCap !== undefined && q.maxBalanceCap !== null ? Number(q.maxBalanceCap) : null,
    waitingPeriodDays: q.waitingPeriodDays !== undefined ? Number(q.waitingPeriodDays) : 0,
    allowsHalfDay: Boolean(q.allowsHalfDay),
    requiresNote: Boolean(q.requiresNote),
    requiresDocument: Boolean(q.requiresDocument),
    requiresPositiveBalance: q.requiresPositiveBalance !== undefined ? Boolean(q.requiresPositiveBalance) : true,
    minRequestDays: q.minRequestDays !== undefined ? Number(q.minRequestDays) : 0.5,
    maxRequestDays: q.maxRequestDays !== undefined && q.maxRequestDays !== null ? Number(q.maxRequestDays) : null,
    allowedCountries: q.allowedCountries ?? null,
    milestones: milestones.length > 0 ? milestones : undefined,
  };
}

export function frontendPolicyToCreateDto(policy: Partial<CountryPolicy>): CreatePolicyDto {
  if (!policy.policyName || !policy.countryCode) {
    throw new Error('policyName and countryCode are required');
  }

  return {
    policyName: policy.policyName.trim(),
    countryCode: policy.countryCode.trim(),
    workingHoursPerDay: Number(policy.workingHoursPerDay || 8),
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

    const maxConsecutiveVal = r.maxConsecutiveDays !== undefined && r.maxConsecutiveDays !== null
      ? Number(r.maxConsecutiveDays)
      : r.maxConsecutive ?? 10;

    return {
      leaveTypeId: r.leaveTypeId,
      leaveType: (r.leaveType || r.leaveTypeId || '') as LeaveTypeKey,
      entitlementDays: r.entitlementDays ?? 0,
      isAccrued: Boolean(r.isAccrued),
      accrualRate: r.accrualRate ?? 0,
      carryOverEnabled: Boolean(r.carryOverEnabled),
      maxCarryOver: r.maxCarryOver ?? 0,
      maxConsecutive: maxConsecutiveVal,
      maxConsecutiveDays: maxConsecutiveVal,
      minNoticeDays: r.minNoticeDays ?? 0,
      accrualInterval: r.accrualInterval === BackendAccrualInterval.YEARLY ? 'yearly' : 'monthly',
      seniorityMilestones: milestones,
      isCutOffDifferentFromHireDate: isCustomCutOff,
      cutOffDate: cutOffDateStr,
      carryOverExpiration: r.carryOverExpirationEnabled ? '90 days' : '',
      maxBalanceCap: r.maxBalanceCap ?? null,
      resetDate: cutOffDateStr || '01-01',
      resetDaysCount: r.resetDaysCount ?? 0,
      waitingPeriodDays: r.waitingPeriodDays ?? 0,
      allowsHalfDay: Boolean(r.allowsHalfDay),
      requiresNote: Boolean(r.requiresNote),
      requiresDocument: Boolean(r.requiresDocument),
      requiresPositiveBalance: r.requiresPositiveBalance !== undefined ? Boolean(r.requiresPositiveBalance) : true,
      minRequestDays: r.minRequestDays !== undefined ? Number(r.minRequestDays) : 0.5,
      maxRequestDays: r.maxRequestDays !== undefined && r.maxRequestDays !== null ? Number(r.maxRequestDays) : null,
      allowedCountries: r.allowedCountries ?? null,
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
    divisionAssignment: res.divisionAssignment || '',
    leaveQuotas: quotas,
    createdAt: res.createdAt ? res.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
    updatedAt: res.updatedAt ? res.updatedAt.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}
