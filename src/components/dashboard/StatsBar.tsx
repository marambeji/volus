import { useState, useEffect } from 'react';
import { getMyLeaveBalances } from '../../services/employeesApi';

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
    { id: 2, label: 'Pending Leave (Days)', value: '...', icon: <span className="flex">⏳</span> },
    { id: 3, label: 'Approved this Year', value: '...', icon: <span className="flex">✅</span> },
    { id: 4, label: 'Team Out Today', value: '3', icon: <span className="flex">👥</span> },
  ]);

  useEffect(() => {
    async function loadStats() {
      try {
        const conf = await getMyLeaveBalances();
        if (conf && conf.balances) {
          const annual = conf.balances.find((b: any) => b.code === 'ANNUAL') || conf.balances[0];
          if (annual) {
            setStats(prev => [
              { ...prev[0], value: String(annual.availableBalance ?? 0) },
              { ...prev[1], value: String(annual.pendingAmount ?? 0) },
              { ...prev[2], value: String(annual.approvedUsed ?? 0) },
              prev[3],
            ]);
          }
        }
      } catch (err) {
        console.error('Error loading stats', err);
      }
    }
    loadStats();
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
