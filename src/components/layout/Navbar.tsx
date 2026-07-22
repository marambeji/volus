import { NavLink } from 'react-router-dom';
import { Home, User, Users, CheckSquare, Calendar, X } from 'lucide-react';

interface NavbarProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

const sections = [
  {
    title: 'GENERAL',
    items: [
      { label: 'Home', path: '/employee/dashboard', icon: Home },
      { label: 'Full Calendar', path: '/employee/full-calendar', icon: Calendar },
    ]
  },
  {
    title: 'EMPLOYEES',
    items: [
      { label: 'People', path: '/employee/people', icon: Users },
      { label: 'My Info', path: '/employee/my-info', icon: User },
    ]
  },
  {
    title: 'MANAGEMENT',
    items: [
      { label: 'Approval Dashboard', path: '/employee/approval-dashboard', icon: CheckSquare },
    ]
  }
];

export default function Navbar({ isOpen, onClose }: NavbarProps) {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{"role":"employee"}');

  const visibleSections = sections.filter(sec => {
    if (sec.title === 'MANAGEMENT') {
      return currentUser.role === 'manager';
    }
    return true;
  });

  return (
    <>
      {/* Mobile Drawer Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-45 w-64 bg-[#111c44] text-slate-300 border-r border-[#1e306e]/20 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header (Logo + Mobile Close Button) */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#1e306e]/20 flex-shrink-0">
          {/* Logo with Green Dot */}
          <div className="flex items-center">
            <svg viewBox="0 0 200 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
              {/* N */}
              <text x="0" y="30" fill="white" fontSize="28" fontWeight="900" letterSpacing="1" style={{fontFamily:"'Arial Black',Arial,sans-serif",fontWeight:900}}>N</text>
              {/* Green dot circle replacing O */}
              <circle cx="36" cy="20" r="7.5" fill="#96C13C" />
              {/* VELUS */}
              <text x="50" y="30" fill="white" fontSize="28" fontWeight="900" letterSpacing="1" style={{fontFamily:"'Arial Black',Arial,sans-serif",fontWeight:900}}>VELUS</text>
            </svg>
          </div>

          {/* Close button (mobile only) */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6">
          {visibleSections.map((section, idx) => (
            <div key={idx} className="flex flex-col gap-1.5">
              {/* Section Header */}
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-1">
                {section.title}
              </span>
              
              {/* Section Links */}
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/employee/dashboard'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 ${
                      isActive
                        ? 'bg-[#1e306e]/50 text-white border-l-4 border-[#96C13C]'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#1e306e]/20 flex flex-col gap-3">
          <div className="text-[10px] text-slate-500 font-bold tracking-wider text-center py-2">
            © 2026 NOVELUS
          </div>
        </div>
      </aside>
    </>
  );
}
export type { NavbarProps };
