import { Bell, Check, CheckCircle2 } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';

export default function Notifications() {
  const { state, dispatch } = useAdmin();
  const unreadCount = state.notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Notifications</h1>
          <p className="text-slate-400 text-sm mt-1">You have {unreadCount} unread alerts</p>
        </div>
        <button onClick={() => dispatch({ type: 'MARK_ALL_READ' })} disabled={unreadCount === 0} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50">
          <CheckCircle2 size={16} /> Mark all read
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col">
        {state.notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No notifications yet.</div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {state.notifications.map(n => (
              <div key={n.id} className={`p-4 flex items-start gap-4 transition-colors ${n.read ? 'opacity-70' : 'bg-violet-50/50 dark:bg-violet-900/10'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${n.read ? 'bg-slate-100 text-slate-400' : 'bg-violet-100 text-violet-600'}`}>
                  <Bell size={18} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className={`text-sm font-bold ${n.read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-white'}`}>{n.title}</h4>
                    <span className="text-[10px] text-slate-400">{new Date(n.timestamp).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{n.message}</p>
                </div>
                {!n.read && (
                  <button onClick={() => dispatch({ type: 'MARK_NOTIFICATION_READ', payload: n.id })} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 cursor-pointer" title="Mark read">
                    <Check size={16}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
