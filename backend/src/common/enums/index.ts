export enum LeavePolicyStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ApprovalWorkflowStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ApproverType {
  MANAGER = 'MANAGER',
  MANAGERS_MANAGER = 'MANAGERS_MANAGER',
  SPECIFIC_PERSON = 'SPECIFIC_PERSON',
  HR = 'HR',
}

export enum AccrualInterval {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum CutOffType {
  FIXED_DATE = 'FIXED_DATE',
  HIRE_DATE = 'HIRE_DATE',
}

export enum ResetType {
  NONE = 'NONE',
  YEARLY = 'YEARLY',
  POLICY_CUTOFF = 'POLICY_CUTOFF',
}

export enum LeaveTrackingMode {
  AVAILABLE_BALANCE = 'AVAILABLE_BALANCE',
  USAGE_YTD = 'USAGE_YTD',
}
