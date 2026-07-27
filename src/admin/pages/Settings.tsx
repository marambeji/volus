import { Settings as SettingsIcon, Shield, Mail, Clock } from 'lucide-react';

export default function Settings() {
  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">System configuration and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'General Settings', desc: 'Company details, logo, and timezone', icon: SettingsIcon },
          { title: 'Roles & Permissions', desc: 'Manage access levels for Admin, Manager, and Employee', icon: Shield },
          { title: 'Email Templates', desc: 'Customize leave approval/rejection email content', icon: Mail },
          { title: 'Working Schedules', desc: 'Configure default daily hours and shifts', icon: Clock },
        ].map((item, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm hover:border-violet-300 dark:hover:border-violet-700 transition-colors cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-500 group-hover:text-violet-600 group-hover:bg-violet-50 transition-colors mb-4"><item.icon size={20} /></div>
            <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">{item.title}</h3>
            <p className="text-xs text-slate-500">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
