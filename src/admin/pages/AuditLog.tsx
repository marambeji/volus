import { useState, useEffect } from 'react';
import SearchInput from '../components/ui/SearchInput';
import { SelectFilter } from '../components/ui/SelectFilter';
import { apiFetch } from '../../services/apiClient';
import { RefreshCw } from 'lucide-react';

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
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');

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

  const actionTypes = [...new Set(logs.map((l) => l.actionType))];

  const filtered = logs.filter(
    (l) =>
      (l.actorName.toLowerCase().includes(search.toLowerCase()) ||
        l.entityType.toLowerCase().includes(search.toLowerCase()) ||
        (l.reason && l.reason.toLowerCase().includes(search.toLowerCase()))) &&
      (!filterAction || l.actionType === filterAction)
  );

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Audit Log</h1>
          <p className="text-slate-400 text-sm mt-1">Track all system actions and modifications in real time</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search user, entity or reason..." />
        </div>
        <SelectFilter
          label="Action Type"
          value={filterAction}
          onChange={setFilterAction}
          options={actionTypes.map((a) => ({ label: a, value: a }))}
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
                <th className="py-3 px-4 text-xs">Changes</th>
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
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                  <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('en-GB')}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-200">
                    {log.actorName} <span className="text-[10px] text-slate-400">({log.actorRole})</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-bold">
                      {log.actionType}
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
                  <td className="py-3.5 px-4 text-[11px] text-slate-500">
                    {log.actionType.includes('_CREATED') || log.actionType.includes('_SUBMITTED') ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">✨ Created</span>
                    ) : log.actionType.includes('_DELETED') || log.actionType.includes('_CANCELLED') ? (
                      <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">🗑️ Deleted/Archived</span>
                    ) : log.changedFields && log.changedFields.length > 0 ? (
                      <span className="font-mono text-violet-600 dark:text-violet-400 font-semibold">
                        {log.changedFields.join(', ')}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
