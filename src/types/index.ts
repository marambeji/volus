// Employee
export interface Employee {
  id: number;
  name: string;
  email: string;
  role?: string; // Job title / position
  avatar?: string;
  hireDate: string;
  department: string;
  unit: string;
  managerId?: number; // Self-referencing link
  country: string;
  status: 'out-today' | 'out-tomorrow' | 'in';
  leaveType?: string;
  dayAmount?: 1 | 0.5; // 1 = full day, 0.5 = half day
}

// 10 Leave Types
export type LeaveTypeKey = 
  | 'annual'
  | 'sick'
  | 'bereavement'
  | 'wedding'
  | 'paternity'
  | 'maternity'
  | 'public_holiday'
  | 'compensation'
  | 'unpaid'
  | 'overtime';

export interface LeaveType {
  key: LeaveTypeKey;
  label: string;
  color: string; // Hex code or Tailwind color
  isAccrued: boolean; // True -> shows "Available", False -> shows "Used YTD"
}

// Leave Balance
export interface LeaveBalance {
  employeeId: number;
  leaveType: LeaveTypeKey;
  amount: number;
}

// Leave Ledger Entry
export interface LeaveLedgerEntry {
  id: number;
  employeeId: number;
  leaveType: LeaveTypeKey;
  date: string;
  description: string;
  change: number; // e.g. -5, +2.5
  balance: number; // running total
}

// Leave Request
export interface LeaveRequest {
  id: number;
  employeeId: number;
  leaveType: LeaveTypeKey;
  startDate: string;
  endDate: string;
  dailyAmounts: { [date: string]: number }; // lets users exclude weekends or set half days
  note?: string;
  submittedDate: string;
  status: 'pending' | 'approved' | 'declined';
  approverComments?: string;
  totalDays: number;
}

// Holiday
export interface Holiday {
  id: number;
  name: string;
  date: string;
  country: string;
  countryCode: string;
  flag: string;
}

// Company Link
export interface CompanyLink {
  id: number;
  country: string;
  flag: string;
  url: string;
}
