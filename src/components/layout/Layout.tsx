import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Menu, Sun, Moon, Bell, LogOut } from 'lucide-react';
import Navbar from './Navbar';
import Chatbot from '../ui/Chatbot';

interface LayoutProps {
  children: ReactNode;
  onLogout?: () => void;
}

export default function Layout({ children, onLogout }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const currentUser = JSON.parse(
    localStorage.getItem('currentUser') || 
    '{"name":"Gabriel Habre","email":"gabriel.habre@novelus.com","role":"employee","avatar":"GH"}'
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f172a] flex text-slate-800 dark:text-slate-200 transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Navbar isOpen={mobileOpen} onClose={() => setMobileOpen(false)} onLogout={onLogout} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">

        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <span className="font-extrabold text-slate-800 tracking-wider text-xs uppercase hidden md:inline bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              Leave Portal
            </span>
          </div>

          {/* Header Right Actions */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} />}
            </button>

            {/* Notifications */}
            <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* User Avatar Info */}
            <div className="flex items-center gap-2.5 pl-2.5 border-l border-slate-200">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-black shadow-xs">
                {currentUser.avatar}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-800 leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight capitalize">{currentUser.role}</p>
              </div>
            </div>

            {/* Logout */}
            {onLogout && (
              <button onClick={onLogout} className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer ml-1" title="Logout">
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>

        {/* Page Main Content */}
        <main className="p-6 md:p-8 flex-1">
          {children}
        </main>
      </div>

      {/* Floating Chatbot — available on all pages */}
      <Chatbot />
    </div>
  );
}
