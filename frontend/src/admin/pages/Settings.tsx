import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { getCurrentUser } from '../utils/useHrPermissions';

export default function Settings() {
  const hrUser = getCurrentUser();

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">System configuration and preferences</p>
      </div>

      {hrUser.isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link to="/admin/hr-permissions" className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm hover:border-violet-300 dark:hover:border-violet-700 transition-colors cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-500 group-hover:text-violet-600 group-hover:bg-violet-50 transition-colors mb-4"><Lock size={20} /></div>
            <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">Roles & Permissions</h3>
            <p className="text-xs text-slate-500">Manage per-user access to HR modules</p>
          </Link>
        </div>
      )}
    </div>
  );
}
