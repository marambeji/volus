import { NavLink } from 'react-router-dom';
import { X, LayoutDashboard, Users, CalendarCheck, Wallet, FileText, Globe, Palmtree, Building2, BarChart3, Settings, ClipboardList, Bell, Shield, History, LogOut } from 'lucide-react';
import { useAdmin } from '../../store/AdminContext';

const nav = [
  { section: 'OVERVIEW',       items: [{ label: 'Dashboard',        path: '/admin/dashboard',   icon: LayoutDashboard }] },
  { section: 'WORKFORCE',      items: [{ label: 'Employees',         path: '/admin/employees',   icon: Users }, { label: 'Departments',       path: '/admin/departments', icon: Building2 }] },
  { section: 'LEAVE MGMT',    items: [{ label: 'Leave Requests',    path: '/admin/leaves',      icon: CalendarCheck }, { label: 'Leave Balances',    path: '/admin/balances',    icon: Wallet }, { label: 'Accrual History',   path: '/admin/accrual-history', icon: History }, { label: 'Leave Policies',    path: '/admin/policies',    icon: FileText }] },
  { section: 'CONFIGURATION', items: [{ label: 'Countries',          path: '/admin/countries',   icon: Globe }, { label: 'Public Holidays',   path: '/admin/holidays',    icon: Palmtree }, { label: 'Approval Levels',   path: '/admin/approval-levels', icon: Shield }] },
  { section: 'ANALYTICS',     items: [{ label: 'Reports',            path: '/admin/reports',     icon: BarChart3 }, { label: 'Audit Log',         path: '/admin/audit',       icon: ClipboardList }, { label: 'Notifications',     path: '/admin/notifications',icon: Bell }] },
  { section: 'SYSTEM',        items: [{ label: 'Settings',           path: '/admin/settings',    icon: Settings }] },
];

export default function AdminSidebar({ isOpen, onClose, onLogout }: { isOpen: boolean; onClose: () => void; onLogout?: () => void }) {
  const { state } = useAdmin();
  const unread = state.notifications.filter(n => !n.read).length;

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{"name":"HR Admin","email":"admin@novelus.com","role":"admin","avatar":"HR"}');

  return (
    <>
      {/* Mobile overlay */}
      <div className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />

      <aside className={`fixed inset-y-0 left-0 z-45 w-64 bg-[#0f172a] text-slate-300 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center">
            <svg viewBox="0 0 200 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
              <text x="0" y="30" fill="white" fontSize="28" fontWeight="900" letterSpacing="1" style={{fontFamily:"'Arial Black',Arial,sans-serif",fontWeight:900}}>N</text>
              <circle cx="36" cy="20" r="7.5" fill="#96C13C" />
              <text x="50" y="30" fill="white" fontSize="28" fontWeight="900" letterSpacing="1" style={{fontFamily:"'Arial Black',Arial,sans-serif",fontWeight:900}}>VELUS</text>
            </svg>
          </div>
          <button onClick={onClose} className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {nav.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3">{section.section}</span>
              <div className="space-y-0.5">
                {section.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) => `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-[#1e293b] text-white border-l-4 border-violet-500' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon size={15} />
                      <span>{item.label}</span>
                    </div>
                    {item.label === 'Notifications' && unread > 0 && (
                      <span className="bg-violet-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">{unread}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer with logged-in user profile & logout */}
        <div className="p-4 border-t border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-black">
                {currentUser.avatar}
              </div>
              <div className="text-left max-w-36 overflow-hidden">
                <p className="text-white text-xs font-bold truncate">{currentUser.name}</p>
                <p className="text-slate-500 text-[10px] truncate">{currentUser.email}</p>
              </div>
            </div>
            {onLogout && (
              <button 
                onClick={onLogout} 
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
