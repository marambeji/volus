import type { LeaveTypeKey } from '../../types';

// ─── Approval Levels ────────────────────────────────────────────────────────
export type ApproverType = 'manager' | 'manager_manager' | 'specific_employee';

export interface ApprovalLevel {
  type: ApproverType;
  specificEmployeeEmail?: string;
}

export interface ApprovalConfiguration {
  id: string;
  name: string;
  levelsCount: number; // 1, 2, or 3
  levels: ApprovalLevel[];
  description?: string;
  createdAt: string;
}

export interface SeniorityMilestone {
  years: number;
  accruedDays: number;
}

// ─── Country Policy ─────────────────────────────────────────────────────────
export interface LeaveQuota {
  leaveType: LeaveTypeKey;
  entitlementDays: number;  // days per year
  isAccrued: boolean;
  accrualRate?: number;     // days per month if accrued
  carryOverEnabled: boolean;
  maxCarryOver: number;     // max days to carry to next year
  maxConsecutive: number;   // max consecutive days allowed
  minNoticeDays: number;    // min days notice required
  // New fields
  accrualInterval?: 'monthly' | 'yearly' | 'custom';
  seniorityMilestoneMonths?: number;
  milestoneAccruedDays?: number;
  seniorityMilestones?: SeniorityMilestone[]; // Multiple milestones support
  isCutOffDifferentFromHireDate?: boolean;
  cutOffDate?: string;
  carryOverExpiration?: string;
  maxBalanceCap?: number;
  resetDate?: string;       // MM-DD
  resetDaysCount?: number;
  waitingPeriodDays?: number;
}

export interface CountryPolicy {
  id: string;
  policyName: string;
  country: string;
  countryCode: string;
  flag: string;
  weekendDays: number[];    // 0=Sun,1=Mon,...,6=Sat
  workingHoursPerDay: number;
  approvalWorkflow: 'manager_only' | 'hr_only' | 'manager_then_hr' | string; // Reference to workflow or custom code
  leaveQuotas: LeaveQuota[];
  createdAt: string;
  updatedAt: string;
  divisionAssignment?: string;
}

// ─── Extended Employee ───────────────────────────────────────────────────────
export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface AdminEmployee {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  position: string;
  department: string;
  unit: string;
  managerId?: number;
  country: string;
  countryCode: string;
  hireDate: string;
  status: 'active' | 'inactive' | 'archived' | 'on_leave';
  workingSchedule: 'full_time' | 'part_time' | 'remote';
  emergencyContacts: EmergencyContact[];
  policyId: string;
  // New fields
  role?: string; // 'HR Admin' | 'Manager' | 'Employee'
  division?: string;
  approvalLevelId?: string; // Links to ApprovalConfiguration
}

// ─── Department ──────────────────────────────────────────────────────────────
export interface Team {
  id: number;
  name: string;
  managerId?: number;
  memberIds: number[];
}

export interface Department {
  id: number;
  name: string;
  headId?: number;    // department head employee id
  teams: Team[];
  color: string;
}

// ─── Audit Log ───────────────────────────────────────────────────────────────
export type AuditAction =
  | 'EMPLOYEE_ADDED'
  | 'EMPLOYEE_EDITED'
  | 'EMPLOYEE_DELETED'
  | 'EMPLOYEE_ARCHIVED'
  | 'EMPLOYEE_ACTIVATED'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'LEAVE_CANCELLED'
  | 'BALANCE_ADJUSTED'
  | 'BALANCE_RESET'
  | 'BALANCE_CARROVER'
  | 'POLICY_CREATED'
  | 'POLICY_UPDATED'
  | 'POLICY_DELETED'
  | 'HOLIDAY_ADDED'
  | 'HOLIDAY_DELETED'
  | 'HOLIDAY_EDITED'
  | 'DEPARTMENT_CREATED'
  | 'DEPARTMENT_UPDATED'
  | 'DELETE_DEPARTMENT'
  | 'APPROVAL_LEVEL_CREATED'
  | 'APPROVAL_LEVEL_UPDATED'
  | 'APPROVAL_LEVEL_DELETED'
  | 'NOTE_ADDED';

export interface AuditLogEntry {
  id: number;
  user: string;        // admin user who performed action
  action: AuditAction;
  entity: string;      // 'Employee' | 'LeaveRequest' | 'Balance' | etc.
  entityId: string | number;
  description: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────
export type NotificationType =
  | 'leave_submitted'
  | 'leave_approved'
  | 'leave_rejected'
  | 'balance_updated'
  | 'policy_changed';

export interface AdminNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  employeeId?: number;
  read: boolean;
  timestamp: string;
}

// ─── Extended Leave Request (admin view) ────────────────────────────────────
export interface AdminLeaveRequest {
  id: number;
  employeeId: number;
  leaveType: LeaveTypeKey;
  startDate: string;
  endDate: string;
  dailyAmounts: { [date: string]: number };
  note?: string;
  submittedDate: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  approverComments?: string;
  hrNote?: string;
  totalDays: number;
  balanceBefore?: number;
  balanceAfter?: number;
  // New fields for multi-stage approval workflow
  currentApprovalStage?: number; // 1-indexed
  approvalsLog?: Array<{
    level: number;
    approver: string;
    status: 'approved' | 'rejected';
    comment?: string;
    timestamp: string;
  }>;
}

// ─── Admin Store State ───────────────────────────────────────────────────────
export interface AdminState {
  employees: AdminEmployee[];
  leaveRequests: AdminLeaveRequest[];
  leaveBalances: Array<{ employeeId: number; leaveType: LeaveTypeKey; amount: number }>;
  leaveLedger: Array<{
    id: number;
    employeeId: number;
    leaveType: LeaveTypeKey;
    date: string;
    description: string;
    change: number;
    balance: number;
  }>;
  policies: CountryPolicy[];
  holidays: Array<{
    id: number;
    name: string;
    date: string;
    country: string;
    countryCode: string;
    flag: string;
    recurring: boolean;
  }>;
  departments: Department[];
  auditLog: AuditLogEntry[];
  notifications: AdminNotification[];
  approvalLevels: ApprovalConfiguration[]; // New list
}

