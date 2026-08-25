import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { formatNotification, getCurrentUserId } from '../../utils/notificationFormat';
import { useNotificationReadState } from '../../hooks/useNotificationReadState';

interface AuditNotification {
  id: string;
  actionType: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  reason?: string;
  newValues?: any;
  oldValues?: any;
}

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AuditNotification[]>([]);
  const { readIds, markRead, markAllRead: markAllReadIds } = useNotificationReadState();
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async (signal?: AbortSignal) => {
    const currentUserStr = localStorage.getItem('currentUser');
    if (!currentUserStr) return;
    setLoading(true);
    try {
      const data = await apiFetch<AuditNotification[]>('/audit-logs/my-notifications', { signal });
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to fetch employee notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchNotifications(controller.signal);

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 30000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const markAllRead = () => markAllReadIds(notifications.map((n) => n.id));

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => void fetchNotifications()}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 px-2 py-1 rounded-md hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => {
                const isRead = readIds.has(n.id);
                const info = formatNotification(n, currentUserId);

                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                      isRead
                        ? 'bg-white dark:bg-slate-900 opacity-70'
                        : 'bg-violet-50/40 dark:bg-violet-950/20'
                    }`}
                  >
                    <div className={`p-2 rounded-xl flex-shrink-0 ${info.color}`}>
                      {info.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {info.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {info.desc}
                      </p>
                    </div>

                    {!isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(n.id);
                        }}
                        className="p-1 text-slate-300 hover:text-violet-600 transition-colors"
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex-shrink-0">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/employee/notifications');
              }}
              className="w-full text-center text-[11px] font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 py-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors cursor-pointer"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
