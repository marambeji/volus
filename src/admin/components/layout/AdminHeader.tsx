import { Menu, Bell, Sun, Moon, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAdmin } from '../../store/AdminContext';
import { useNavigate } from 'react-router-dom';

export default function AdminHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { state } = useAdmin();
  const [dark, setDark] = useState(false);
  const navigate = useNavigate();
  const unread = state.notifications.filter(n => !n.read).length;

  function toggleDark() {
    setDark(d => !d);
    document.documentElement.classList.toggle('dark');
  }

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
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
        <button onClick={() => navigate('/admin/notifications')} className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <Bell size={18} />
          {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
        </button>
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-black">HR</div>
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">HR Admin</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Administrator</p>
          </div>
        </div>
        <button className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors ml-1" title="Exit Admin">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
