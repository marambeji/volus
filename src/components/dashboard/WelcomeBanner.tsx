import { useState, useEffect } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { getMyLeaveBalances } from '../../services/employeesApi';
import { apiFetch } from '../../services/apiClient';

// Helper to get greeting based on time of day
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Format today's date nicely
function formatDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface WelcomeBannerProps {
  onRequestTimeOff: () => void;
}

export default function WelcomeBanner({ onRequestTimeOff }: WelcomeBannerProps) {
  const [userName, setUserName] = useState<string>('Employee');
  const [remainingDays, setRemainingDays] = useState<number | string>('...');
  const [isOffToday, setIsOffToday] = useState<boolean>(false);
  const [todayLeaveType, setTodayLeaveType] = useState<string>('');

  useEffect(() => {
    // 1. Get current logged-in user name
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        const namePart = (user.name || user.fullName || 'Employee').split(' ')[0];
        setUserName(namePart);
      } catch (err) {
        console.error('Failed to parse currentUser', err);
      }
    }

    // Also try fetching live profile
    apiFetch<any>('/employees/me')
      .then((me) => {
        if (me && me.fullName) {
          setUserName(me.fullName.split(' ')[0]);
        }
      })
      .catch(() => {});

    // 2. Fetch live leave balances
    async function loadBalances() {
      try {
        const data = await getMyLeaveBalances();
        if (data && data.balances) {
          const annual = data.balances.find(
            (b: any) =>
              b.code === 'ANNUAL' ||
              (b.name && b.name.toLowerCase().includes('annual')) ||
              (b.leaveType && b.leaveType.toLowerCase().includes('annual'))
          ) || data.balances[0];

          if (annual) {
            setRemainingDays(annual.availableBalance ?? 0);
          }
        }
      } catch (err) {
        console.error('Failed to load leave balances for banner', err);
      }
    }

    // 3. Check if current employee is on leave today
    async function checkOffToday() {
      try {
        const myRequests = await apiFetch<any[]>('/leave-requests/my-requests');
        if (Array.isArray(myRequests)) {
          const todayStr = new Date().toISOString().split('T')[0];
          const activeTodayReq = myRequests.find((r) => {
            const isApproved = r.status === 'APPROVED' || r.status === 'approved';
            const s = r.startDate ? r.startDate.split('T')[0] : '';
            const e = r.endDate ? r.endDate.split('T')[0] : '';
            return isApproved && s <= todayStr && e >= todayStr;
          });

          if (activeTodayReq) {
            setIsOffToday(true);
            const typeLabel =
              activeTodayReq.leaveType?.label ||
              activeTodayReq.leaveTypeName ||
              'Leave';
            setTodayLeaveType(typeLabel);
          } else {
            setIsOffToday(false);
          }
        }
      } catch (err) {
        console.error('Failed to check off today status:', err);
      }
    }

    void loadBalances();
    void checkOffToday();
    const handleRefetch = () => {
      void loadBalances();
      void checkOffToday();
    };
    window.addEventListener('leave-request-submitted', handleRefetch);
    return () => { window.removeEventListener('leave-request-submitted', handleRefetch); };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1b2559] via-[#16224F] to-[#111c44] text-white shadow-lg mb-6">
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-white opacity-5 rounded-full" />
      <div className="absolute -bottom-16 -right-4 w-64 h-64 bg-white opacity-5 rounded-full" />
      <div className="absolute top-4 right-24 w-20 h-20 bg-white opacity-5 rounded-full" />

      <div className="relative px-6 py-8 md:py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Left: Greeting */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays size={18} className="opacity-80" />
              <span className="text-blue-200 text-sm font-medium">{formatDate()}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">
              {getGreeting()}, {userName} 👋
            </h1>

            {/* "You are off today" Banner Notification */}
            {isOffToday ? (
              <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-sm font-extrabold shadow-sm backdrop-blur-md">
                <span className="text-base">🌴</span>
                <span>You are off today ({todayLeaveType})</span>
              </div>
            ) : (
              <p className="text-blue-200 text-sm md:text-base mt-1">
                You have <span className="text-white font-semibold">{remainingDays} days</span> of leave remaining this year.
              </p>
            )}
          </div>

          {/* Right: Request Time Off button */}
          <div className="flex-shrink-0">
            <button
              onClick={onRequestTimeOff}
              className="flex items-center gap-2 bg-[#96C13C] hover:bg-[#83aa32] text-white font-extrabold px-6 py-3 rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all duration-150 cursor-pointer"
            >
              <Plus size={18} />
              Request Time Off
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
