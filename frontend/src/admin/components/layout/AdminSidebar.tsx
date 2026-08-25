import { NavLink } from 'react-router-dom';
import { X, LayoutDashboard, Users, CalendarCheck, Wallet, FileText, Globe, Palmtree, Building2, BarChart3, Settings, ClipboardList, Bell, Shield, History, LogOut, Mail, Lock } from 'lucide-react';
import { useAdminUnreadCount } from '../../utils/useAdminUnreadCount';
import { getCurrentUser } from '../../utils/useHrPermissions';
import type { HrModule } from '../../types/hrPermissions';
import { FULL_HR_PERMISSIONS } from '../../types/hrPermissions';

const nav: { section: string; items: { label: string; path: string; icon: any; module?: HrModule }[] }[] = [
  { section: 'OVERVIEW',       items: [{ label: 'Dashboard',        path: '/admin/dashboard',   icon: LayoutDashboard }] },
  { section: 'WORKFORCE',      items: [
    { label: 'Employees',   path: '/admin/employees',   icon: Users, module: 'employees' },
    { label: 'Departments', path: '/admin/departments', icon: Building2, module: 'departments' },
  ] },
  { section: 'LEAVE MGMT',    items: [
    { label: 'Leave Requests',  path: '/admin/leaves',          icon: CalendarCheck, module: 'leaveRequests' },
    { label: 'Leave Balances',  path: '/admin/balances',        icon: Wallet, module: 'leaveBalances' },
    { label: 'Accrual History', path: '/admin/accrual-history', icon: History, module: 'accrualHistory' },
    { label: 'Leave Policies',  path: '/admin/policies',        icon: FileText, module: 'leavePolicies' },
  ] },
  { section: 'CONFIGURATION', items: [
    { label: 'Countries',            path: '/admin/countries',   icon: Globe, module: 'countries' },
    { label: 'Public Holidays',      path: '/admin/holidays',    icon: Palmtree, module: 'publicHolidays' },
    { label: 'Approval Levels',      path: '/admin/approval-levels', icon: Shield, module: 'approvalLevels' },
    { label: 'Notification Manager', path: '/admin/reminders',   icon: Mail, module: 'notificationManager' },
  ] },
  { section: 'ANALYTICS',     items: [
    { label: 'Reports',       path: '/admin/reports',       icon: BarChart3, module: 'reports' },
    { label: 'Audit Log',     path: '/admin/audit',         icon: ClipboardList, module: 'auditLog' },
    { label: 'Notifications', path: '/admin/notifications', icon: Bell, module: 'notifications' },
  ] },
  { section: 'SYSTEM',        items: [{ label: 'Settings', path: '/admin/settings', icon: Settings }] },
];

export default function AdminSidebar({ isOpen, onClose, onLogout }: { isOpen: boolean; onClose: () => void; onLogout?: () => void }) {
  const unread = useAdminUnreadCount();
  const badgeLabel = unread > 99 ? '99+' : String(unread);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{"name":"HR Admin","email":"admin@novelus.com","role":"admin","avatar":"HR"}');
  const hrUser = getCurrentUser();
  const permissions = hrUser.isSuperAdmin ? FULL_HR_PERMISSIONS : (hrUser.permissions || FULL_HR_PERMISSIONS);

  const visibleNav = nav
    .map(section => {
      if (section.section !== 'CONFIGURATION') return section;
      return {
        ...section,
        items: hrUser.isSuperAdmin
          ? [...section.items, { label: 'HR Permissions', path: '/admin/hr-permissions', icon: Lock }]
          : section.items,
      };
    })
    .map(section => ({
      ...section,
      items: section.items.filter(item => !item.module || permissions[item.module as HrModule]?.canView !== false),
    }))
    .filter(section => section.items.length > 0);

  return (
    <>
      {/* Mobile overlay */}
      <div className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />

      <aside className={`fixed inset-y-0 left-0 z-45 w-64 bg-[#0f172a] text-slate-300 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 print:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
          {visibleNav.map((section, idx) => (
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
                      <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{badgeLabel}</span>
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
