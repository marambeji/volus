import type { ReportBalanceRow } from '../../services/reportsApi';

function formatHeader(key: string): string {
  if (!key) return 'Other';
  if (key.toLowerCase().startsWith('seq_leave') || key.toLowerCase().startsWith('seq leave')) {
    return 'Sequential Leave';
  }
  return key
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getInitials(name: string): string {
  if (!name) return 'EM';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-pink-500 to-rose-600',
];

function getAvatarBg(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default function BalancesTable({ rows }: { rows: ReportBalanceRow[] }) {
  // Deduplicate and format leave type headers
  const typeKeys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.balances)))).sort();

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-100 dark:border-slate-700/80 bg-white dark:bg-slate-800 shadow-sm">
      <table className="w-full text-left text-sm border-collapse min-w-[700px]">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/40 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <th className="py-4 px-5">Employee</th>
            <th className="py-4 px-4">Department</th>
            <th className="py-4 px-4">Country</th>
            {typeKeys.map((key) => (
              <th key={key} className="py-4 px-4 text-center whitespace-nowrap">
                {formatHeader(key)}
              </th>
            ))}
            <th className="py-4 px-5 text-center whitespace-nowrap">Total Available</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4 + typeKeys.length} className="py-16 text-center text-slate-400">
                <div className="flex flex-col items-center justify-center gap-2">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">No balances found</span>
                  <span className="text-xs text-slate-400">Try adjusting your filters or search terms.</span>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const bgGradient = getAvatarBg(r.employeeName);
              const initials = getInitials(r.employeeName);

              return (
                <tr
                  key={r.employeeId}
                  className="hover:bg-violet-50/40 dark:hover:bg-slate-700/40 transition-colors group"
                >
                  {/* Employee Name & Avatar */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${bgGradient} text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-800 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                          {r.employeeName}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Department */}
                  <td className="py-4 px-4 text-slate-600 dark:text-slate-300 font-medium">
                    {r.department ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {r.department}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">—</span>
                    )}
                  </td>

                  {/* Country */}
                  <td className="py-4 px-4 text-slate-500 dark:text-slate-400 font-medium">
                    {r.country || '—'}
                  </td>

                  {/* Individual Leave Type Balances */}
                  {typeKeys.map((key) => {
                    const balance = r.balances[key];
                    const val = balance ? balance.available : 0;
                    const isNegative = val < 0;
                    const isZero = val === 0;

                    return (
                      <td key={key} className="py-4 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-xl font-bold text-xs transition-all ${
                            isNegative
                              ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-900/60'
                              : isZero
                              ? 'text-slate-400 dark:text-slate-500 font-normal'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-emerald-200/60 dark:ring-emerald-900/40'
                          }`}
                        >
                          {val}d
                        </span>
                      </td>
                    );
                  })}

                  {/* Total Available Balance */}
                  <td className="py-4 px-5 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-2xl text-xs font-black ring-1 ${
                        r.totalAvailable < 0
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 ring-red-300'
                          : 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 ring-violet-200 dark:ring-violet-900/50'
                      }`}
                    >
                      {r.totalAvailable}d
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
