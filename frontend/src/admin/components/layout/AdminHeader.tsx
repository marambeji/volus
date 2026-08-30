import { Menu, Bell, Sun, Moon, LogOut, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminUnreadCount } from '../../utils/useAdminUnreadCount';
import { getGlobalAuditLogs, type AuditLogEntry } from '../../../services/auditLogsApi';

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
  if (type.includes('APPROVED'))                              return { bg: 'bg-emerald-100', text: 'text-emerald-600' };
  if (type.includes('REJECTED') || type.includes('DECLINED')) return { bg: 'bg-red-100',     text: 'text-red-600' };
  if (type.includes('SUBMITTED') || type.includes('CREATED')) return { bg: 'bg-violet-100',  text: 'text-violet-600' };
  if (type.includes('UPDATED'))                               return { bg: 'bg-blue-100',    text: 'text-blue-600' };
  if (type.includes('BALANCE') || type.includes('LEDGER'))    return { bg: 'bg-amber-100',   text: 'text-amber-600' };
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

export default function AdminHeader({ onMenuClick, onLogout }: { onMenuClick: () => void; onLogout?: () => void }) {
  const [dark, setDark] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AuditLogEntry[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(loadReadIds);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const unread = useAdminUnreadCount();

  function toggleDark() {
    setDark(d => !d);
    document.documentElement.classList.toggle('dark');
  }

  // Load notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await getGlobalAuditLogs();
        setNotifications(data.slice(0, 5)); // Show only 5 most recent
      } catch (error) {
        console.error('Failed to load notifications:', error);
      }
    };

    if (showNotifications && notifications.length === 0) {
      fetchNotifications();
    }
  }, [showNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNotifications]);

  const markRead = (id: string) => {
    const next = new Set([...readIds, id]);
    setReadIds(next);
    saveReadIds(next);
  };

  const unreadNotifications = notifications.filter(n => !readIds.has(n.id));

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm print:hidden">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100">
          <Menu size={20} />
        </button>
        <span className="hidden md:inline font-extrabold text-slate-800 dark:text-white text-xs uppercase tracking-widest bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-700">
          HR Admin Portal
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={toggleDark} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          {dark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>

          {/* Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Notifications</h3>
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/admin/notifications');
                  }}
                  className="text-xs text-violet-600 hover:text-violet-700 font-semibold cursor-pointer"
                >
                  View All
                </button>
              </div>

              {/* Tabs */}
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex gap-2">
                <button className="px-3 py-1.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg text-xs font-bold">
                  All
                </button>
                <button className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold">
                  Unread
                </button>
              </div>

              {/* Notifications List */}
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No notifications yet
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {/* Nouveau section */}
                    {unreadNotifications.length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New</h4>
                        </div>
                        {unreadNotifications.map(n => {
                          const { bg, text } = actionColor(n.actionType);
                          const title = ACTION_TITLES[n.actionType] ?? n.actionType.replace(/_/g, ' ');
                          const message = n.description ?? `${n.actorName} — ${title}`;
                          const date = new Date(n.timestamp);
                          const now = new Date();
                          const diffMs = now.getTime() - date.getTime();
                          const diffMins = Math.floor(diffMs / 60000);
                          const diffHours = Math.floor(diffMs / 3600000);
                          const timeAgo = diffMins < 60 ? `${diffMins} min` : `${diffHours} h`;

                          return (
                            <div
                              key={n.id}
                              className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer flex items-start gap-3"
                              onClick={() => markRead(n.id)}
                            >
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bg} ${text}`}>
                                <Bell size={16} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-bold text-slate-800 dark:text-white line-clamp-2">
                                    {title}
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{timeAgo}</span>
                                    <span className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0"></span>
                                  </div>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                  {message}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Earlier section */}
                    {notifications.filter(n => readIds.has(n.id)).length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Earlier</h4>
                        </div>
                        {notifications.filter(n => readIds.has(n.id)).map(n => {
                          const title = ACTION_TITLES[n.actionType] ?? n.actionType.replace(/_/g, ' ');
                          const message = n.description ?? `${n.actorName} — ${title}`;
                          const date = new Date(n.timestamp);
                          const now = new Date();
                          const diffMs = now.getTime() - date.getTime();
                          const diffMins = Math.floor(diffMs / 60000);
                          const diffHours = Math.floor(diffMs / 3600000);
                          const timeAgo = diffMins < 60 ? `${diffMins} min` : `${diffHours} h`;

                          return (
                            <div
                              key={n.id}
                              className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer flex items-start gap-3 opacity-60"
                            >
                              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100 text-slate-400">
                                <Bell size={16} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 line-clamp-2">
                                    {title}
                                  </p>
                                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{timeAgo}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                  {message}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-black">HR</div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">HR Admin</p>
              <span className="px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] font-black uppercase tracking-wider rounded-full shadow-sm">
                Final Version
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Administrator</p>
          </div>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-colors ml-1 cursor-pointer"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
