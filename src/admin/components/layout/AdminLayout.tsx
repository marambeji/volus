import { useState } from 'react';
import type { ReactNode } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

interface AdminLayoutProps {
  children: ReactNode;
  onSwitchRole?: (role: 'employee' | 'admin') => void;
}

export default function AdminLayout({ children, onSwitchRole }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex text-slate-800 dark:text-slate-200">
      <AdminSidebar isOpen={mobileOpen} onClose={() => setMobileOpen(false)} onSwitchRole={onSwitchRole} />
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        <AdminHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
