import { useState, useEffect } from 'react';
import { RefreshCw, History, User, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import SlideDrawer from './ui/SlideDrawer';
import { apiFetch } from '../../services/apiClient';

interface AuditLogItem {
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

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityName?: string;
}

export default function HistoryDrawer({ isOpen, onClose, entityType, entityId, entityName }: HistoryDrawerProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AuditLogItem[]>(
        `/audit-logs/history?entityType=${entityType}&entityId=${entityId}`
      );
      setLogs(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch history logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, entityId, entityType]);

  const getBadgeColor = (action: string) => {
    if (action.includes('CREATED') || action.includes('SUBMITTED') || action.includes('APPROVED')) {
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    }
    if (action.includes('DELETED') || action.includes('REJECTED') || action.includes('CANCELLED')) {
      return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300';
    }
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  };

  const formatActionName = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <SlideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Audit History"
      subtitle={`Tracking changes for ${entityName || entityType} (#${entityId.slice(0, 8)})`}
      width="max-w-2xl"
    >
      {loading && (
        <div className="py-12 text-center text-slate-400 text-sm flex justify-center items-center gap-2">
          <RefreshCw size={16} className="animate-spin text-violet-600" /> Loading history...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && logs.length === 0 && (
        <div className="py-12 text-center text-slate-400 text-sm">
          No audit logs recorded for this {entityType.toLowerCase()} yet.
        </div>
      )}

      {!loading && !error && logs.length > 0 && (
        <div className="relative border-l border-slate-200 dark:border-slate-700 ml-4 space-y-8 py-2">
          {logs.map((log) => {
            const hasChanges = log.changedFields && log.changedFields.length > 0;
            return (
              <div key={log.id} className="relative pl-6">
                {/* Timeline node */}
                <span className="absolute -left-[11px] top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet-50 dark:bg-slate-800 border-2 border-violet-600">
                  <History size={10} className="text-violet-600" />
                </span>

                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${getBadgeColor(log.actionType)}`}>
                      {formatActionName(log.actionType)}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <Calendar size={12} />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Actor details */}
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <User size={13} className="text-slate-400" />
                    <span>{log.actorName}</span>
                    <span className="text-[10px] bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                      {log.actorRole}
                    </span>
                  </div>

                  {/* Reason if provided */}
                  {log.reason && (
                    <div className="flex items-start gap-1.5 bg-slate-100/50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs italic text-slate-500 dark:text-slate-400">
                      <MessageSquare size={13} className="mt-0.5 text-slate-400 flex-shrink-0" />
                      <span>"{log.reason}"</span>
                    </div>
                  )}

                  {/* Visual Diff */}
                  {hasChanges && log.oldValues && log.newValues && (
                    <div className="mt-1.5 space-y-1 bg-white dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-900/60">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Changed Fields</p>
                      <div className="space-y-1.5">
                        {log.changedFields!.map((key) => {
                          const oldVal = log.oldValues[key];
                          const newVal = log.newValues[key];
                          return (
                            <div key={key} className="text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-50 dark:border-slate-900/30 pb-1.5 last:border-b-0 last:pb-0">
                              <span className="font-bold text-slate-500 dark:text-slate-400">{key}</span>
                              <span className="text-right truncate max-w-xs text-slate-600 dark:text-slate-300">
                                <span className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-1 py-0.5 rounded line-through mr-1.5 font-mono">
                                  {oldVal === null || oldVal === undefined ? 'null' : String(oldVal)}
                                </span>
                                ➔
                                <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded ml-1.5 font-mono">
                                  {newVal === null || newVal === undefined ? 'null' : String(newVal)}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SlideDrawer>
  );
}
