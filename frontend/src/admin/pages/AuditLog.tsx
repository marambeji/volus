import { useState, useEffect } from 'react';
import SearchInput from '../components/ui/SearchInput';
import { SelectFilter } from '../components/ui/SelectFilter';
import { apiFetch } from '../../services/apiClient';
import { RefreshCw, RotateCcw } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';


interface AuditLogRecord {
  id: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  actionType: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  oldValues?: any;
  newValues?: any;
  changedFields?: string[];
  reason?: string;
  description?: string;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Reset to page 1 on filter change
  useEffect(() => { setCurrentPage(1); }, [search, filterAction]);

  const loadLogs = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const data = await apiFetch<AuditLogRecord[]>('/audit-logs/global', { signal });
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load global audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadLogs(controller.signal);
    return () => controller.abort();
  }, []);

  const PREFERRED_ORDER = [
    'EMPLOYEE_CREATED',
    'EMPLOYEE_UPDATED',
    'EMPLOYEE_DELETED',
    'LEAVE_REQUEST_SUBMITTED',
    'LEAVE_REQUEST_APPROVED',
    'LEAVE_REQUEST_REJECTED',
    'LEAVE_REQUEST_CANCELLED',
    'APPROVAL_STEP_APPROVED',
    'APPROVAL_STEP_REJECTED',
    'APPROVAL_STEP_SKIPPED',
    'WORKFLOW_CREATED',
    'WORKFLOW_UPDATED',
    'WORKFLOW_DELETED',
    'BALANCE_ADJUSTED',
    'LEDGER_USAGE_CREATED',
    'LEDGER_REVERSAL_CREATED',
    'POLICY_ASSIGNED',
  ];

  const actionTypes = [...new Set(logs.map((l) => l.actionType))].sort((a, b) => {
    const idxA = PREFERRED_ORDER.indexOf(a);
    const idxB = PREFERRED_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const filtered = logs.filter(
    (l) =>
      (l.actorName.toLowerCase().includes(search.toLowerCase()) ||
        l.entityType.toLowerCase().includes(search.toLowerCase()) ||
        (l.reason && l.reason.toLowerCase().includes(search.toLowerCase())) ||
        (l.description && l.description.toLowerCase().includes(search.toLowerCase()))) &&
      (!filterAction || l.actionType === filterAction)
  );

  const getRoleLabel = (role: string) => {
    const map: Record<string, string> = {
      HR_ADMIN: 'HR Admin',
      MANAGER: 'Manager',
      EMPLOYEE: 'Employee',
      SYSTEM: 'System',
    };
    return map[role] ?? role;
  };

  const getActionTypeLabel = (action: string) => {
    const map: Record<string, string> = {
      EMPLOYEE_CREATED: 'Employee Created',
      EMPLOYEE_UPDATED: 'Employee Updated',
      EMPLOYEE_DELETED: 'Employee Deleted',
      LEAVE_REQUEST_SUBMITTED: 'Leave Request Submitted',
      LEAVE_REQUEST_APPROVED: 'Leave Request Approved',
      LEAVE_REQUEST_REJECTED: 'Leave Request Rejected',
      LEAVE_REQUEST_CANCELLED: 'Leave Request Cancelled',
      APPROVAL_STEP_APPROVED: 'Approval Step Approved',
      APPROVAL_STEP_REJECTED: 'Approval Step Rejected',
      APPROVAL_STEP_SKIPPED: 'Approval Step Skipped',
      WORKFLOW_CREATED: 'Workflow Created',
      WORKFLOW_UPDATED: 'Workflow Updated',
      WORKFLOW_DELETED: 'Workflow Deleted',
      BALANCE_ADJUSTED: 'Balance Adjusted',
      LEDGER_USAGE_CREATED: 'Ledger Usage Created',
      LEDGER_REVERSAL_CREATED: 'Ledger Reversal Created',
      POLICY_ASSIGNED: 'Policy Assigned',
    };
    return map[action] ?? action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const isUuid = (str: any): boolean => {
    if (typeof str !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  };

  const formatFallbackDescription = (log: AuditLogRecord): string => {
    const actor = `${getRoleLabel(log.actorRole)} ${log.actorName}`;
    const targetName =
      log.newValues?.fullName ||
      log.oldValues?.fullName ||
      log.newValues?.name ||
      log.oldValues?.name ||
      log.newValues?.policyName ||
      log.oldValues?.policyName ||
      '';
    const nameStr = targetName ? ` "${targetName}"` : '';
    const reasonStr = log.reason ? ` — reason: ${log.reason}` : '';

    const skipDiffFields = new Set([
      'createdAt', 'updatedAt', 'deletedAt', 'password', 'token',
      'secret', 'document', 'avatar', 'id', 'correlationId',
      'workflowSnapshot', 'approvalInstances',
    ]);

    const formatVal = (v: any) => {
      if (v === null || v === undefined) return 'none';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    };

    const buildDiff = (): string => {
      const fields = log.changedFields || [];
      const visible = fields.filter((f) => !skipDiffFields.has(f));
      if (visible.length === 0) return '';

      if (visible.length === 1) {
        const f = visible[0];
        const oldVal = log.oldValues?.[f];
        const newVal = log.newValues?.[f];
        if (oldVal !== undefined || newVal !== undefined) {
          return `: changed ${f} from "${formatVal(oldVal)}" to "${formatVal(newVal)}"`;
        }
        return `: updated ${f}`;
      }

      if (visible.length <= 3) {
        return (
          ': updated fields: ' +
          visible
            .map((f) => {
              const oldVal = log.oldValues?.[f];
              const newVal = log.newValues?.[f];
              if (oldVal !== undefined || newVal !== undefined) {
                return `${f} ("${formatVal(oldVal)}" → "${formatVal(newVal)}")`;
              }
              return f;
            })
            .join(', ')
        );
      }

      return `: updated ${visible.length} fields: ${visible.slice(0, 3).join(', ')} and ${visible.length - 3} more`;
    };

    switch (log.actionType) {
      case 'EMPLOYEE_CREATED':
        return `${actor} added a new employee:${nameStr}`;
      case 'EMPLOYEE_UPDATED':
        return `${actor} updated employee${nameStr}${buildDiff()}`;
      case 'EMPLOYEE_DELETED':
        return `${actor} deleted employee${nameStr}`;
      case 'LEAVE_REQUEST_SUBMITTED': {
        let leaveType = log.newValues?.leaveType?.label || log.newValues?.leaveTypeId || 'leave';
        if (isUuid(leaveType)) leaveType = 'leave';
        return `${actor} submitted a ${leaveType} request`;
      }
      case 'LEAVE_REQUEST_APPROVED': {
        let leaveType = log.newValues?.leaveType?.label || log.newValues?.leaveTypeId || 'leave';
        if (isUuid(leaveType)) leaveType = 'leave';
        const empName = log.newValues?.employee?.fullName || log.newValues?.employeeName || '';
        const empStr = empName ? ` for ${empName}` : '';
        return `${actor} approved a ${leaveType} request${empStr}`;
      }
      case 'LEAVE_REQUEST_REJECTED': {
        let leaveType = log.newValues?.leaveType?.label || log.newValues?.leaveTypeId || 'leave';
        if (isUuid(leaveType)) leaveType = 'leave';
        const empName = log.newValues?.employee?.fullName || log.newValues?.employeeName || '';
        const empStr = empName ? ` for ${empName}` : '';
        return `${actor} rejected a ${leaveType} request${empStr}${reasonStr}`;
      }
      case 'LEAVE_REQUEST_CANCELLED': {
        let leaveType = log.newValues?.leaveType?.label || log.newValues?.leaveTypeId || 'leave';
        if (isUuid(leaveType)) leaveType = 'leave';
        return `${actor} cancelled a ${leaveType} request${reasonStr}`;
      }
      case 'WORKFLOW_CREATED':
        return `${actor} created a new approval workflow${nameStr}`;
      case 'WORKFLOW_UPDATED':
        return `${actor} updated approval workflow${nameStr}`;
      case 'WORKFLOW_DELETED':
        return `${actor} deleted approval workflow${nameStr}`;
      case 'BALANCE_ADJUSTED':
        return `${actor} adjusted leave balance${reasonStr}`;
      default:
        return `${actor} performed action ${log.actionType.toLowerCase().replace(/_/g, ' ')} on ${log.entityType}${nameStr}`;
    }
  };

  // Pagination calculations
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Audit Log</h1>
          <p className="text-slate-400 text-sm mt-1">Track all system actions and modifications in real time</p>
        </div>
        <button
          onClick={() => void loadLogs()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-600 rounded-xl text-sm shadow-sm transition-all cursor-pointer disabled:opacity-40"
        >
          <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search user, entity or reason..." />
        </div>
        <SelectFilter
          label="Action Type"
          value={filterAction}
          onChange={setFilterAction}
          options={actionTypes.map((a) => ({ label: getActionTypeLabel(a), value: a }))}
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm flex justify-center items-center gap-2">
          <RefreshCw size={16} className="animate-spin text-violet-600" /> Loading audit history...
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-[11px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 dark:bg-slate-800/50">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Reason / Details</th>
                <th className="py-3 px-4 text-xs">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 text-sm">
                    No audit records found
                  </td>
                </tr>
              )}
              {paginated.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                  <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('en-GB')}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-200">
                    {log.actorName} <span className="text-[10px] text-slate-400">({log.actorRole})</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-bold">
                      {getActionTypeLabel(log.actionType)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-500">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {log.entityType}{' '}
                      {log.newValues?.fullName || log.oldValues?.fullName || log.newValues?.name || log.oldValues?.name ? (
                        `(${log.newValues?.fullName || log.oldValues?.fullName || log.newValues?.name || log.oldValues?.name})`
                      ) : (
                        <span className="text-[10px] text-slate-400">#{log.entityId.slice(0, 8)}</span>
                      )}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-800 dark:text-slate-200">
                    {log.reason || '—'}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300 font-medium max-w-xs">
                    <span style={{ whiteSpace: 'pre-line' }}>
                      {log.description || formatFallbackDescription(log)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            currentPage={currentPage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            pageSizeOptions={[15, 30, 50]}
          />
        </div>
      )}
    </div>
  );
}
