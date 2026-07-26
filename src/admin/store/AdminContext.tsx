import { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AdminState, AuditAction, AdminEmployee, CountryPolicy, AuditLogEntry, Department, ApprovalConfiguration } from '../types/adminTypes';
import type { LeaveTypeKey } from '../../types';
import {
  adminEmployeesList, adminLeaveRequests, adminLeaveBalances, adminLeaveLedger,
  countriesPolicies, adminHolidays, adminDepartments, adminAuditLog, adminNotifications
} from '../data/adminMockData';
import { getEmployees } from '../../services/employeesApi';
import { toAdminEmployee } from '../../services/mappers/employeeMapper';
import { getBalances } from '../../services/balancesApi';
import { apiFetch } from '../../services/apiClient';

// ─── Mock Approval Configurations ──────────────────────────────────────────────
const mockApprovalLevels: ApprovalConfiguration[] = [
  {
    id: 'app-1',
    name: 'Standard Manager Approval',
    levelsCount: 1,
    levels: [{ type: 'manager' }],
    description: 'Requires approval only from the direct manager.',
    createdAt: '2026-01-01'
  },
  {
    id: 'app-2',
    name: 'Two-Tier Escalation',
    levelsCount: 2,
    levels: [{ type: 'manager' }, { type: 'manager_manager' }],
    description: 'First manager, then manager\'s manager.',
    createdAt: '2026-01-01'
  },
  {
    id: 'app-3',
    name: 'Executive Review',
    levelsCount: 2,
    levels: [{ type: 'manager' }, { type: 'specific_employee', specificEmployeeEmail: 'riad.mansour@novelus.com' }],
    description: 'Manager approval followed by CEO Riad Mansour\'s approval.',
    createdAt: '2026-01-01'
  }
];

// ─── Initial State ────────────────────────────────────────────────────────────
const initialState: AdminState = {
  employees: adminEmployeesList.map(e => ({
    ...e,
    role: e.id === 10 ? 'HR Admin' : e.id === 1 || e.id === 2 || e.id === 3 ? 'Manager' : 'Employee',
    division: e.country === 'Lebanon' ? 'Levant' : e.country === 'France' ? 'Europe' : 'International',
    approvalLevelId: (typeof e.id === 'number' ? e.id : String(e.id).charCodeAt(0)) % 3 === 0 ? 'app-2' : (typeof e.id === 'number' ? e.id : String(e.id).charCodeAt(0)) % 3 === 1 ? 'app-1' : 'app-3'
  })),
  leaveRequests: adminLeaveRequests,
  leaveBalances: adminLeaveBalances,
  leaveLedger: adminLeaveLedger,
  policies: countriesPolicies,
  holidays: adminHolidays,
  departments: adminDepartments,
  auditLog: adminAuditLog,
  notifications: adminNotifications,
  approvalLevels: mockApprovalLevels,
};

// ─── Actions ──────────────────────────────────────────────────────────────────
type Action =
  | { type: 'ADD_EMPLOYEE'; payload: AdminEmployee }
  | { type: 'UPDATE_EMPLOYEE'; payload: AdminEmployee }
  | { type: 'DELETE_EMPLOYEE'; payload: number | string }
  | { type: 'TOGGLE_EMPLOYEE_STATUS'; payload: { id: number | string; status: AdminEmployee['status'] } }
  | { type: 'APPROVE_REQUEST'; payload: { id: number | string; comment?: string } }
  | { type: 'REJECT_REQUEST'; payload: { id: number | string; comment: string } }
  | { type: 'CANCEL_REQUEST'; payload: number | string }
  | { type: 'ADD_NOTE'; payload: { id: number | string; note: string } }
  | { type: 'ADJUST_BALANCE'; payload: { employeeId: number | string; leaveType: LeaveTypeKey; delta: number; reason: string } }
  | { type: 'RESET_BALANCE'; payload: { employeeId: number | string; leaveType: LeaveTypeKey; value: number } }
  | { type: 'ADD_POLICY'; payload: CountryPolicy }
  | { type: 'UPDATE_POLICY'; payload: CountryPolicy }
  | { type: 'DELETE_POLICY'; payload: string }
  | { type: 'ADD_HOLIDAY'; payload: (typeof adminHolidays)[0] }
  | { type: 'DELETE_HOLIDAY'; payload: number }
  | { type: 'UPDATE_HOLIDAY'; payload: (typeof adminHolidays)[0] }
  | { type: 'ADD_DEPARTMENT'; payload: Department }
  | { type: 'UPDATE_DEPARTMENT'; payload: Department }
  | { type: 'DELETE_DEPARTMENT'; payload: number }
  | { type: 'MARK_NOTIFICATION_READ'; payload: number | string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'ADD_APPROVAL_LEVEL'; payload: ApprovalConfiguration }
  | { type: 'UPDATE_APPROVAL_LEVEL'; payload: ApprovalConfiguration }
  | { type: 'DELETE_APPROVAL_LEVEL'; payload: string }
  | { type: 'SET_EMPLOYEES'; payload: AdminEmployee[] }
  | { type: 'SET_BALANCES'; payload: Array<{ employeeId: number | string; leaveType: LeaveTypeKey; amount: number }> };

function addAuditEntry(
  state: AdminState,
  action: AuditAction,
  entity: string,
  entityId: string | number,
  description: string,
  previousValue?: string,
  newValue?: string
): AuditLogEntry[] {
  const entry: AuditLogEntry = {
    id: state.auditLog.length + 1,
    user: 'HR Admin',
    action,
    entity,
    entityId,
    description,
    previousValue,
    newValue,
    timestamp: new Date().toISOString(),
  };
  return [entry, ...state.auditLog];
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function adminReducer(state: AdminState, action: Action): AdminState {
  switch (action.type) {

    case 'ADD_EMPLOYEE':
      return {
        ...state,
        employees: [...state.employees, action.payload],
        leaveBalances: [
          ...state.leaveBalances,
          ...(['annual','sick','bereavement','wedding','paternity','maternity','public_holiday','compensation','unpaid','overtime'] as LeaveTypeKey[])
            .map(lt => ({ employeeId: action.payload.id, leaveType: lt, amount: 0 }))
        ],
        auditLog: addAuditEntry(state, 'EMPLOYEE_ADDED', 'Employee', action.payload.id, `Added employee ${action.payload.name}`, '-', 'active'),
        notifications: [{ id: state.notifications.length + 1, type: 'balance_updated', title: 'Employee Added', message: `${action.payload.name} has been added to the system`, read: false, timestamp: new Date().toISOString() }, ...state.notifications],
      };

    case 'UPDATE_EMPLOYEE': {
      const prev = state.employees.find(e => e.id === action.payload.id);
      return {
        ...state,
        employees: state.employees.map(e => e.id === action.payload.id ? action.payload : e),
        auditLog: addAuditEntry(state, 'EMPLOYEE_EDITED', 'Employee', action.payload.id, `Updated employee ${action.payload.name}`, prev ? JSON.stringify(prev) : undefined, JSON.stringify(action.payload)),
      };
    }

    case 'DELETE_EMPLOYEE': {
      const emp = state.employees.find(e => e.id === action.payload);
      return {
        ...state,
        employees: state.employees.filter(e => e.id !== action.payload),
        auditLog: addAuditEntry(state, 'EMPLOYEE_DELETED', 'Employee', action.payload, `Deleted employee ${emp?.name ?? action.payload}`),
      };
    }

    case 'TOGGLE_EMPLOYEE_STATUS': {
      const emp = state.employees.find(e => e.id === action.payload.id);
      return {
        ...state,
        employees: state.employees.map(e => e.id === action.payload.id ? { ...e, status: action.payload.status } : e),
        auditLog: addAuditEntry(state, action.payload.status === 'archived' ? 'EMPLOYEE_ARCHIVED' : 'EMPLOYEE_ACTIVATED', 'Employee', action.payload.id, `Changed status for ${emp?.name} to ${action.payload.status}`, emp?.status, action.payload.status),
      };
    }

    case 'APPROVE_REQUEST': {
      const req = state.leaveRequests.find(r => r.id === action.payload.id);
      if (!req) return state;

      const emp = state.employees.find(e => e.id === req.employeeId);
      const appConfig = state.approvalLevels.find(a => a.id === emp?.approvalLevelId);

      if (appConfig && appConfig.levelsCount > 1) {
        // Multi-stage approval
        const currentStage = req.currentApprovalStage || 1;
        const approvalsLog = req.approvalsLog || [];
        const nextApprovalsLog = [
          ...approvalsLog,
          {
            level: currentStage,
            approver: `HR Admin (Acting: Level ${currentStage})`,
            status: 'approved' as const,
            comment: action.payload.comment,
            timestamp: new Date().toISOString()
          }
        ];

        if (currentStage < appConfig.levelsCount) {
          // Progress approval, but not final
          return {
            ...state,
            leaveRequests: state.leaveRequests.map(r =>
              r.id === req.id
                ? {
                    ...r,
                    currentApprovalStage: currentStage + 1,
                    approvalsLog: nextApprovalsLog
                  }
                : r
            ),
            auditLog: addAuditEntry(
              state,
              'LEAVE_APPROVED',
              'LeaveRequest',
              req.id,
              `Approved approval level ${currentStage} of ${appConfig.levelsCount} for ${emp?.name}'s ${req.leaveType} leave`,
              `Level ${currentStage}`,
              `Level ${currentStage + 1}`
            ),
          };
        }
      }

      // Final or single approval
      const currentStage = req.currentApprovalStage || 1;
      const approvalsLog = req.approvalsLog || [];
      const finalApprovalsLog = [
        ...approvalsLog,
        {
          level: currentStage,
          approver: `HR Admin (Acting: Level ${currentStage})`,
          status: 'approved' as const,
          comment: action.payload.comment,
          timestamp: new Date().toISOString()
        }
      ];

      const updatedBalances = state.leaveBalances.map(b =>
        b.employeeId === req.employeeId && b.leaveType === req.leaveType
          ? { ...b, amount: Math.max(0, b.amount - req.totalDays) }
          : b
      );
      const balBefore = state.leaveBalances.find(b => b.employeeId === req.employeeId && b.leaveType === req.leaveType)?.amount ?? 0;
      const balAfter = Math.max(0, balBefore - req.totalDays);
      
      return {
        ...state,
        leaveRequests: state.leaveRequests.map(r =>
          r.id === action.payload.id ? { ...r, status: 'approved', approverComments: action.payload.comment, balanceBefore: balBefore, balanceAfter: balAfter, approvalsLog: finalApprovalsLog, currentApprovalStage: currentStage } : r
        ),
        leaveBalances: updatedBalances,
        leaveLedger: [{ id: state.leaveLedger.length + 1, employeeId: req.employeeId, leaveType: req.leaveType, date: new Date().toISOString().split('T')[0], description: `${req.leaveType} leave approved (${req.startDate} to ${req.endDate})`, change: -req.totalDays, balance: balAfter }, ...state.leaveLedger],
        auditLog: addAuditEntry(state, 'LEAVE_APPROVED', 'LeaveRequest', req.id, `Fully approved ${req.leaveType} leave for ${emp?.name}`, 'pending', 'approved'),
        notifications: [{ id: state.notifications.length + 1, type: 'leave_approved', title: 'Leave Approved', message: `${req.leaveType} leave for ${emp?.name} has been approved`, employeeId: req.employeeId, read: false, timestamp: new Date().toISOString() }, ...state.notifications],
      };
    }

    case 'REJECT_REQUEST': {
      const req = state.leaveRequests.find(r => r.id === action.payload.id);
      const emp = state.employees.find(e => e.id === req?.employeeId);
      const currentStage = req?.currentApprovalStage || 1;
      const approvalsLog = req?.approvalsLog || [];
      const rejectLog = [
        ...approvalsLog,
        {
          level: currentStage,
          approver: 'HR Admin',
          status: 'rejected' as const,
          comment: action.payload.comment,
          timestamp: new Date().toISOString()
        }
      ];

      return {
        ...state,
        leaveRequests: state.leaveRequests.map(r =>
          r.id === action.payload.id ? { ...r, status: 'declined', approverComments: action.payload.comment, approvalsLog: rejectLog } : r
        ),
        auditLog: addAuditEntry(state, 'LEAVE_REJECTED', 'LeaveRequest', action.payload.id, `Rejected leave request for ${emp?.name}: ${action.payload.comment}`, 'pending', 'declined'),
        notifications: [{ id: state.notifications.length + 1, type: 'leave_rejected', title: 'Leave Rejected', message: `Leave request for ${emp?.name} has been declined`, employeeId: req?.employeeId, read: false, timestamp: new Date().toISOString() }, ...state.notifications],
      };
    }

    case 'CANCEL_REQUEST':
      return { ...state, leaveRequests: state.leaveRequests.map(r => r.id === action.payload ? { ...r, status: 'cancelled' } : r) };

    case 'ADD_NOTE':
      return { ...state, leaveRequests: state.leaveRequests.map(r => r.id === action.payload.id ? { ...r, hrNote: action.payload.note } : r) };

    case 'ADJUST_BALANCE': {
      const { employeeId, leaveType, delta, reason } = action.payload;
      const current = state.leaveBalances.find(b => b.employeeId === employeeId && b.leaveType === leaveType)?.amount ?? 0;
      const newAmount = Math.max(0, current + delta);
      const emp = state.employees.find(e => e.id === employeeId);
      return {
        ...state,
        leaveBalances: state.leaveBalances.map(b => b.employeeId === employeeId && b.leaveType === leaveType ? { ...b, amount: newAmount } : b),
        leaveLedger: [{ id: state.leaveLedger.length + 1, employeeId, leaveType, date: new Date().toISOString().split('T')[0], description: reason, change: delta, balance: newAmount }, ...state.leaveLedger],
        auditLog: addAuditEntry(state, 'BALANCE_ADJUSTED', 'LeaveBalance', employeeId, `Adjusted ${leaveType} balance for ${emp?.name} by ${delta > 0 ? '+' : ''}${delta}. Reason: ${reason}`, String(current), String(newAmount)),
      };
    }

    case 'RESET_BALANCE': {
      const { employeeId, leaveType, value } = action.payload;
      const current = state.leaveBalances.find(b => b.employeeId === employeeId && b.leaveType === leaveType)?.amount ?? 0;
      const emp = state.employees.find(e => e.id === employeeId);
      return {
        ...state,
        leaveBalances: state.leaveBalances.map(b => b.employeeId === employeeId && b.leaveType === leaveType ? { ...b, amount: value } : b),
        leaveLedger: [{ id: state.leaveLedger.length + 1, employeeId, leaveType, date: new Date().toISOString().split('T')[0], description: `Balance reset to ${value}`, change: value - current, balance: value }, ...state.leaveLedger],
        auditLog: addAuditEntry(state, 'BALANCE_RESET', 'LeaveBalance', employeeId, `Reset ${leaveType} balance for ${emp?.name} to ${value}`, String(current), String(value)),
      };
    }

    case 'ADD_POLICY':
      return { ...state, policies: [...state.policies, action.payload], auditLog: addAuditEntry(state, 'POLICY_CREATED', 'Policy', action.payload.id, `Created policy ${action.payload.policyName}`) };

    case 'UPDATE_POLICY':
      return { ...state, policies: state.policies.map(p => p.id === action.payload.id ? action.payload : p), auditLog: addAuditEntry(state, 'POLICY_UPDATED', 'Policy', action.payload.id, `Updated policy ${action.payload.policyName}`) };

    case 'DELETE_POLICY': {
      const pol = state.policies.find(p => p.id === action.payload);
      return {
        ...state,
        policies: state.policies.filter(p => p.id !== action.payload),
        auditLog: addAuditEntry(state, 'POLICY_DELETED', 'Policy', action.payload, `Deleted policy ${pol?.policyName ?? action.payload}`)
      };
    }

    case 'ADD_HOLIDAY':
      return { ...state, holidays: [...state.holidays, action.payload], auditLog: addAuditEntry(state, 'HOLIDAY_ADDED', 'Holiday', action.payload.id, `Added holiday ${action.payload.name} for ${action.payload.country}`) };

    case 'DELETE_HOLIDAY': {
      const hol = state.holidays.find(h => h.id === action.payload);
      return {
        ...state,
        holidays: state.holidays.filter(h => h.id !== action.payload),
        auditLog: addAuditEntry(state, 'HOLIDAY_DELETED', 'Holiday', action.payload, `Deleted holiday ${hol?.name ?? action.payload} for ${hol?.country ?? ''}`)
      };
    }

    case 'UPDATE_HOLIDAY':
      return {
        ...state,
        holidays: state.holidays.map(h => h.id === action.payload.id ? action.payload : h),
        auditLog: addAuditEntry(state, 'HOLIDAY_EDITED', 'Holiday', action.payload.id, `Updated holiday ${action.payload.name} for ${action.payload.country}`)
      };

    case 'ADD_DEPARTMENT':
      return {
        ...state,
        departments: [...state.departments, action.payload],
        auditLog: addAuditEntry(state, 'DEPARTMENT_CREATED', 'Department', action.payload.id, `Created department ${action.payload.name}`)
      };

    case 'UPDATE_DEPARTMENT':
      return {
        ...state,
        departments: state.departments.map(d => d.id === action.payload.id ? action.payload : d),
        auditLog: addAuditEntry(state, 'DEPARTMENT_UPDATED', 'Department', action.payload.id, `Updated department ${action.payload.name}`)
      };

    case 'DELETE_DEPARTMENT': {
      const dept = state.departments.find(d => d.id === action.payload);
      return {
        ...state,
        departments: state.departments.filter(d => d.id !== action.payload),
        auditLog: addAuditEntry(state, 'DELETE_DEPARTMENT', 'Department', action.payload, `Deleted department ${dept?.name ?? action.payload}`)
      };
    }

    case 'MARK_NOTIFICATION_READ':
      return { ...state, notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n) };

    case 'MARK_ALL_READ':
      return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) };

    case 'ADD_APPROVAL_LEVEL':
      return {
        ...state,
        approvalLevels: [...state.approvalLevels, action.payload],
        auditLog: addAuditEntry(state, 'APPROVAL_LEVEL_CREATED', 'ApprovalLevel', action.payload.id, `Created approval configuration ${action.payload.name}`)
      };

    case 'UPDATE_APPROVAL_LEVEL':
      return {
        ...state,
        approvalLevels: state.approvalLevels.map(a => a.id === action.payload.id ? action.payload : a),
        auditLog: addAuditEntry(state, 'APPROVAL_LEVEL_UPDATED', 'ApprovalLevel', action.payload.id, `Updated approval configuration ${action.payload.name}`)
      };

    case 'DELETE_APPROVAL_LEVEL': {
      const app = state.approvalLevels.find(a => a.id === action.payload);
      return {
        ...state,
        approvalLevels: state.approvalLevels.filter(a => a.id !== action.payload),
        auditLog: addAuditEntry(state, 'APPROVAL_LEVEL_DELETED', 'ApprovalLevel', action.payload, `Deleted approval configuration ${app?.name ?? action.payload}`)
      };
    }

    case 'SET_EMPLOYEES':
      return { ...state, employees: action.payload };

    case 'SET_BALANCES':
      return { ...state, leaveBalances: action.payload };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface AdminContextType {
  state: AdminState;
  dispatch: React.Dispatch<Action>;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(adminReducer, initialState);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [backendEmps] = await Promise.all([
          getEmployees(),
        ]);

        if (!active) return;

        const mappedEmps = backendEmps.map(toAdminEmployee);
        
        // Fetch calculated balances for each employee from the backend service engine
        const balancePromises = mappedEmps.map(async (emp) => {
          try {
            const calculated = await apiFetch<any>(`/leave-balances/employee/${emp.id}`);
            return (calculated?.balances || []).map((b: any) => ({
              employeeId: emp.id,
              leaveTypeId: b.leaveTypeId,
              code: b.code || b.leaveType,
              leaveType: (b.code || b.leaveType || 'annual') as LeaveTypeKey,
              amount: Number(b.available ?? b.availableBalance ?? 0),
              entitlement: Number(b.entitlement ?? b.annualEntitlement ?? 0),
              earned: Number(b.earned ?? b.accruedAmount ?? 0),
              adjustments: Number(b.adjustments ?? b.manualAdjustments ?? 0),
              used: Number(b.used ?? b.approvedUsed ?? 0),
              pending: Number(b.pending ?? b.pendingAmount ?? 0),
              available: Number(b.available ?? b.availableBalance ?? 0),
              remaining: Number(b.remaining ?? b.availableBalance ?? 0),
            }));
          } catch {
            return [];
          }
        });

        const allCalculatedBals = (await Promise.all(balancePromises)).flat();

        dispatch({ type: 'SET_EMPLOYEES', payload: mappedEmps });
        if (allCalculatedBals.length > 0) {
          dispatch({ type: 'SET_BALANCES', payload: allCalculatedBals });
        }
      } catch (err) {
        console.error('Failed to load live employees/balances:', err);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, []);

  return <AdminContext.Provider value={{ state, dispatch }}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
