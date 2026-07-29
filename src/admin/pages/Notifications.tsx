import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { getGlobalAuditLogs, type AuditLogEntry } from '../../services/auditLogsApi';

// ── Action type → friendly notification title ─────────────────────────────────
const ACTION_TITLES: Record<string, string> = {
  LEAVE_REQUEST_SUBMITTED:  'New Leave Request',
  LEAVE_REQUEST_APPROVED:   'Leave Approved',
  LEAVE_REQUEST_REJECTED:   'Leave Declined',
  LEAVE_REQUEST_CANCELLED:  'Leave Cancelled',
  APPROVAL_STEP_APPROVED:   'Step Approved',
  APPROVAL_STEP_REJECTED:   'Step Rejected',
  APPROVAL_STEP_SKIPPED:    'Step Skipped',
  LEDGER_USAGE_CREATED:     'Balance Deducted',
  LEDGER_REVERSAL_CREATED:  'Balance Reversed',
  BALANCE_ADJUSTED:         'Balance Updated',
  EMPLOYEE_CREATED:         'New Employee Added',
  EMPLOYEE_UPDATED:         'Employee Updated',
  EMPLOYEE_DELETED:         'Employee Removed',
  WORKFLOW_CREATED:         'Workflow Created',
  WORKFLOW_UPDATED:         'Workflow Updated',
  WORKFLOW_DELETED:         'Workflow Deleted',
  POLICY_ASSIGNED:          'Policy Assigned',
};

// ── Icon color per action type ────────────────────────────────────────────────
function actionColor(type: string): { bg: string; text: string } {
  if (type.includes('APPROVED'))                        return { bg: 'bg-emerald-100', text: 'text-emerald-600' };
  if (type.includes('REJECTED') || type.includes('DECLINED')) return { bg: 'bg-red-100', text: 'text-red-600' };
  if (type.includes('SUBMITTED') || type.includes('CREATED'))  return { bg: 'bg-violet-100', text: 'text-violet-600' };
  if (type.includes('UPDATED'))                         return { bg: 'bg-blue-100', text: 'text-blue-600' };
  if (type.includes('BALANCE') || type.includes('LEDGER')) return { bg: 'bg-amber-100', text: 'text-amber-600' };
  return { bg: 'bg-slate-100', text: 'text-slate-500' };
}

// ── localStorage helpers ──────────────────────────────────────────────────────
const LS_KEY = 'notif_read_ids';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch { return new Set<string>(); }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
    window.dispatchEvent(new CustomEvent('notif_read_updated'));
  } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Notifications() {
  const [logs, setLogs]       = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Persisted read IDs — initialised from localStorage so they survive refresh
  const [readIds, setReadIds] = useState<Set<string>>(loadReadIds);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getGlobalAuditLogs();
      setLogs(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const markRead = (id: string) => {
    const next = new Set([...readIds, id]);
    setReadIds(next);
    saveReadIds(next);
  };

  const markAllRead = () => {
    const next = new Set(logs.map(l => l.id));
    setReadIds(next);
    saveReadIds(next);
  };

  const unreadCount = logs.filter(l => !readIds.has(l.id)).length;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Notifications</h1>
          <p className="text-slate-400 text-sm mt-1">
            {loading ? 'Loading…' : `You have ${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer hover:bg-slate-200"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 size={16} /> Mark all read
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col">
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={32} className="animate-spin" />
            <p className="text-sm">Loading notifications…</p>
          </div>
        ) : error ? (
          <div className="p-8 flex items-start gap-3 text-red-600 bg-red-50 rounded-2xl">
            <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No notifications yet.</div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {logs.map(n => {
              const isRead = readIds.has(n.id);
              const { bg, text } = actionColor(n.actionType);
              const title = ACTION_TITLES[n.actionType] ?? n.actionType.replace(/_/g, ' ');
              const message = n.description ?? `${n.actorName} — ${title}`;
              return (
                <div
                  key={n.id}
                  className={`p-4 flex items-start gap-4 transition-colors ${isRead ? 'opacity-70' : 'bg-violet-50/50 dark:bg-violet-900/10'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isRead ? 'bg-slate-100 text-slate-400' : bg + ' ' + text}`}>
                    <Bell size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className={`text-sm font-bold truncate ${isRead ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                        {title}
                      </h4>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">
                        {new Date(n.timestamp).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{message}</p>
                    {n.actorName && (
                      <p className="text-[10px] text-slate-400 mt-0.5">By {n.actorName}</p>
                    )}
                  </div>
                  {!isRead && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 cursor-pointer flex-shrink-0"
                      title="Mark read"
                    >
                      <Check size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
