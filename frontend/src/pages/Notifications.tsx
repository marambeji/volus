import { useState, useEffect, useCallback } from 'react';
import { Check, CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { getMyNotifications, type AuditLogEntry } from '../services/auditLogsApi';
import Pagination from '../components/ui/Pagination';
import SearchInput from '../admin/components/ui/SearchInput';
import { formatNotification, getCurrentUserId } from '../utils/notificationFormat';
import { useNotificationReadState } from '../hooks/useNotificationReadState';

export default function Notifications() {
  const currentUserId = getCurrentUserId();
  const [logs, setLogs]       = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [search, setSearch] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]       = useState(15);

  useEffect(() => { setCurrentPage(1); }, [search]);

  const { readIds, markRead, markAllRead: markAllReadIds } = useNotificationReadState();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMyNotifications();
      setLogs(data);
      setCurrentPage(1);
    } catch (e: any) {
      setError(e.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const markAllRead = () => markAllReadIds(logs.map(l => l.id));

  const unreadCount = logs.filter(l => !readIds.has(l.id)).length;

  const filteredLogs = search.trim()
    ? logs.filter(n => {
        const { title, desc } = formatNotification(n, currentUserId);
        const actor = (n.actorName ?? '').toLowerCase();
        const q = search.toLowerCase();
        return title.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || actor.includes(q);
      })
    : logs;

  const paginated = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

      {/* Search bar */}
      <div className="flex gap-3 items-center">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search notifications by title, message or actor…"
          />
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
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No notifications match your search.</div>
        ) : (
          <>
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {paginated.map(n => {
                const isRead = readIds.has(n.id);
                const info = formatNotification(n, currentUserId);
                return (
                  <div
                    key={n.id}
                    className={`p-4 flex items-start gap-4 transition-colors ${isRead ? 'opacity-70' : 'bg-violet-50/50 dark:bg-violet-900/10'}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isRead ? 'bg-slate-100 text-slate-400' : info.color}`}>
                      {info.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={`text-sm font-bold truncate ${isRead ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                          {info.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">
                          {new Date(n.timestamp).toLocaleString('en-GB', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{info.desc}</p>
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

            <Pagination
              currentPage={currentPage}
              totalItems={filteredLogs.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              pageSizeOptions={[15, 30, 50]}
            />
          </>
        )}
      </div>
    </div>
  );
}
