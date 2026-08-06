import { useState, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import { upcomingHolidays } from '../../data/mockData';
import { getHolidays } from '../../services/holidaysApi';
import { getCountries } from '../../services/countriesApi';

// How many days until a given ISO date string
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

// Format date nicely
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function UpcomingHolidays() {
  const [holidaysList, setHolidaysList] = useState<any[]>(upcomingHolidays);

  useEffect(() => {
    async function loadRealHolidays() {
      try {
        const countries = await getCountries().catch(() => []);
        const realHolidays = await getHolidays(undefined, '2026', countries || []).catch(() => []);
        if (Array.isArray(realHolidays) && realHolidays.length > 0) {
          const mapped = realHolidays.map((h: any) => ({
            id: h.id,
            name: h.name,
            date: h.date,
            country: h.countryName || 'Global',
            flag: h.flag || '🏳️',
          }));
          setHolidaysList(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch real holidays:', err);
      }
    }
    void loadRealHolidays();
  }, []);

  // Sort by date ascending
  const sorted = [...holidaysList].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
          <CalendarDays size={16} className="text-emerald-600" />
        </div>
        <h2 className="text-slate-800 font-semibold text-base">Upcoming Holidays</h2>
      </div>

      {/* List */}
      <div className="divide-y divide-slate-50 overflow-y-auto" style={{ maxHeight: '340px' }}>
        {sorted.map((holiday) => {
          const days = daysUntil(holiday.date);
          const isPast = days < 0;
          const isSoon = days >= 0 && days <= 7;

          return (
            <div
              key={holiday.id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
            >
              {/* Flag */}
              <span className="text-2xl flex-shrink-0">{holiday.flag}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-slate-800 font-medium text-sm truncate">{holiday.name}</p>
                <p className="text-slate-400 text-xs">{holiday.country} · {formatDate(holiday.date)}</p>
              </div>

              {/* Countdown */}
              <div className="flex-shrink-0 text-right">
                {isPast ? (
                  <span className="text-xs text-slate-300 font-medium">Past</span>
                ) : days === 0 ? (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Today!
                  </span>
                ) : isSoon ? (
                  <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    in {days}d
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-400">
                    in {days}d
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
