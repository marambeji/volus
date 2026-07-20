import { NavLink } from 'react-router-dom';
import { X, LayoutDashboard, Users, CalendarCheck, Wallet, FileText, Globe, Palmtree, Building2, BarChart3, Settings, ClipboardList, Bell, ArrowLeftRight, Shield, History } from 'lucide-react';
import { useAdmin } from '../../store/AdminContext';

const nav = [
  { section: 'OVERVIEW',       items: [{ label: 'Dashboard',        path: '/admin',             icon: LayoutDashboard }] },
  { section: 'WORKFORCE',      items: [{ label: 'Employees',         path: '/admin/employees',   icon: Users }, { label: 'Departments',       path: '/admin/departments', icon: Building2 }] },
  { section: 'LEAVE MGMT',    items: [{ label: 'Leave Requests',    path: '/admin/leaves',      icon: CalendarCheck }, { label: 'Leave Balances',    path: '/admin/balances',    icon: Wallet }, { label: 'Accrual History',   path: '/admin/accrual-history', icon: History }, { label: 'Leave Policies',    path: '/admin/policies',    icon: FileText }] },
  { section: 'CONFIGURATION', items: [{ label: 'Countries',          path: '/admin/countries',   icon: Globe }, { label: 'Public Holidays',   path: '/admin/holidays',    icon: Palmtree }, { label: 'Approval Levels',   path: '/admin/approval-levels', icon: Shield }] },
  { section: 'ANALYTICS',     items: [{ label: 'Reports',            path: '/admin/reports',     icon: BarChart3 }, { label: 'Audit Log',         path: '/admin/audit',       icon: ClipboardList }, { label: 'Notifications',     path: '/admin/notifications',icon: Bell }] },
  { section: 'SYSTEM',        items: [{ label: 'Settings',           path: '/admin/settings',    icon: Settings }] },
];

export default function AdminSidebar({ isOpen, onClose, onSwitchRole }: { isOpen: boolean; onClose: () => void; onSwitchRole?: (role: 'employee' | 'admin') => void }) {
  const { state } = useAdmin();
  const unread = state.notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Mobile overlay */}
      <div className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />

      <aside className={`fixed inset-y-0 left-0 z-45 w-64 bg-[#0f172a] text-slate-300 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <LayoutDashboard size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white font-extrabold text-sm tracking-wide">HR Admin</p>
              <p className="text-slate-500 text-[10px] font-medium">Novelus Portal</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"><X size={18} /></button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 flex flex-col gap-5">
          {nav.map((section) => (
            <div key={section.section} className="flex flex-col gap-0.5">
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-1">{section.section}</span>
              {section.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${isActive ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon size={15} />
                    {item.label}
                  </span>
                  {item.label === 'Notifications' && unread > 0 && (
                    <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{unread}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex flex-col gap-3">
          <button 
            onClick={() => onSwitchRole?.('employee')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <ArrowLeftRight size={14} />
            Switch to Employee
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-[10px] font-black">HR</div>
            <div>
              <p className="text-white text-xs font-bold">HR Admin</p>
              <p className="text-slate-500 text-[10px]">hr@novelus.com</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
