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

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACTOR = 'CONTRACTOR',
  INTERN = 'INTERN',
}

export enum WorkMode {
  ONSITE = 'ONSITE',
  HYBRID = 'HYBRID',
  REMOTE = 'REMOTE',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum EmployeeRole {
  HR_ADMIN = 'HR_ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export enum LedgerTransactionType {
  INITIAL_GRANT = 'INITIAL_GRANT',
  ACCRUAL = 'ACCRUAL',
  USAGE = 'USAGE',
  REVERSAL = 'REVERSAL',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
  CARRY_OVER = 'CARRY_OVER',
  RESET = 'RESET',
}

export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}
