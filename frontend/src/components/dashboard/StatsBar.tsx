import { useState, useEffect } from 'react';
import { getMyLeaveBalances } from '../../services/employeesApi';
import { apiFetch } from '../../services/apiClient';

// Minimalist card config mimicking the upload screenshot
const cardConfigs = [
  {
    // Leave Balance
    iconBg: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
  },
  {
    // Pending Requests
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400',
  },
  {
    // Approved This Year
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
  },
  {
    // Team Out Today
    iconBg: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
  },
];

export default function StatsBar() {
  const [stats, setStats] = useState([
    { id: 1, label: 'Available Leave', value: '...', icon: <span className="flex">🏖️</span> },
    { id: 2, label: 'Pending Leave (Days)', value: '0', icon: <span className="flex">⏳</span> },
    { id: 3, label: 'Approved this Year', value: '0', icon: <span className="flex">✅</span> },
    { id: 4, label: 'Team Out Today', value: '3', icon: <span className="flex">👥</span> },
  ]);

  useEffect(() => {
    async function loadStats() {
      try {
        const [balancesData, myRequests] = await Promise.all([
          getMyLeaveBalances().catch(() => null),
          apiFetch<any[]>('/leave-requests/my-requests').catch(() => []),
        ]);

        let available = 0;
        let approved = 0;
        let pending = 0;

        if (balancesData && balancesData.balances) {
          const annual = balancesData.balances.find(
            (b: any) =>
              b.code === 'ANNUAL' ||
              (b.name && b.name.toLowerCase().includes('annual')) ||
              (b.leaveType && b.leaveType.toLowerCase().includes('annual'))
          ) || balancesData.balances[0];

          if (annual) {
            available = annual.availableBalance ?? 0;
          }

          balancesData.balances.forEach((b: any) => {
            approved += Number(b.approvedUsed ?? b.usageYtd ?? 0);
          });
        }

        if (Array.isArray(myRequests)) {
          myRequests.forEach((req: any) => {
            if (req.status === 'PENDING') {
              pending += Number(req.durationDays || 0);
            }
          });
        }

        let teamOutCount = 0;
        try {
          const whosOutRequests = await apiFetch<any[]>('/leave-requests/whos-out').catch(() => []);
          if (Array.isArray(whosOutRequests)) {
            const todayStr = new Date().toISOString().split('T')[0];
            teamOutCount = whosOutRequests.filter((r) => {
              const isApp = r.currentStatus === 'APPROVED' || r.status === 'APPROVED';
              const s = r.startDate ? r.startDate.split('T')[0] : '';
              const e = r.endDate ? r.endDate.split('T')[0] : '';
              return isApp && s <= todayStr && e >= todayStr;
            }).length;
          }
        } catch (_) { }

        setStats([
          { id: 1, label: 'Available Leave', value: String(available), icon: <span className="flex">🏖️</span> },
          { id: 2, label: 'Pending Leave (Days)', value: String(pending), icon: <span className="flex">⏳</span> },
          { id: 3, label: 'Approved this Year', value: String(approved), icon: <span className="flex">✅</span> },
          { id: 4, label: 'Team Out Today', value: String(teamOutCount), icon: <span className="flex">👥</span> },
        ]);
      } catch (err) {
        console.error('Error loading stats', err);
      }
    }

    void loadStats();
    const handleRefetch = () => { void loadStats(); };
    window.addEventListener('leave-request-submitted', handleRefetch);
    return () => { window.removeEventListener('leave-request-submitted', handleRefetch); };
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
      {stats.map((stat, i) => {
        const config = cardConfigs[i] ?? cardConfigs[0];
        return (
          <div
            key={stat.id}
            className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-sm transition-all duration-200 cursor-default flex items-center justify-between min-h-[100px]"
          >
            {/* Left details: Label on top, Count on bottom */}
            <div className="flex flex-col">
              <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                {stat.label}
              </p>
              <p className="text-slate-800 dark:text-white text-2xl font-black leading-none">
                {stat.value}
              </p>
            </div>

            {/* Right: Icon bubble */}
            <div className={`${config.iconBg} w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0`}>
              {stat.icon}
            </div>
          </div>
        );
      })}
    </div>
  );
}
