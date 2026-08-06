import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { ReportRequestRow } from '../../services/reportsApi';

const statusConfig: Record<string, { label: string; badge: string }> = {
  APPROVED: {
    label: 'Approved',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/50',
  },
  REJECTED: {
    label: 'Rejected',
    badge: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900/50',
  },
  CANCELLED: {
    label: 'Cancelled',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
  },
  PENDING: {
    label: 'Pending',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/50',
  },
};

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-pink-500 to-rose-600',
];

function getInitials(name: string): string {
  if (!name) return 'EM';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getAvatarBg(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function RequestsTable({ rows }: { rows: ReportRequestRow[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [rows, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return (
    <div className="rounded-3xl border border-slate-100 dark:border-slate-700/80 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/40 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="py-4 px-5">Employee</th>
              <th className="py-4 px-4">Leave Type</th>
              <th className="py-4 px-4">Dates</th>
              <th className="py-4 px-4 text-center">Duration</th>
              <th className="py-4 px-4 text-center">Status</th>
              <th className="py-4 px-4">Department</th>
              <th className="py-4 px-5">Country</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">No requests found</span>
                    <span className="text-xs text-slate-400">Try adjusting your date range or filters.</span>
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((r) => {
                const bgGradient = getAvatarBg(r.employeeName);
                const initials = getInitials(r.employeeName);
                const st = statusConfig[r.status] ?? {
                  label: r.status,
                  badge: 'bg-slate-100 text-slate-600 ring-slate-200',
                };

                return (
                  <tr
                    key={r.id}
                    className="hover:bg-violet-50/40 dark:hover:bg-slate-700/40 transition-colors group"
                  >
                    {/* Employee */}
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

                    {/* Leave Type */}
                    <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {r.leaveTypeName}
                    </td>

                    {/* Dates */}
                    <td className="py-4 px-4 text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Calendar size={12} className="text-slate-400 shrink-0" />
                        {fmtDate(r.startDate)} &#8594; {fmtDate(r.endDate)}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="py-4 px-4 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 font-extrabold text-xs">
                        {r.durationDays}d
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-xl text-[11px] font-bold ring-1 ${st.badge}`}
                      >
                        {st.label}
                      </span>
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
                    <td className="py-4 px-5 text-slate-500 dark:text-slate-400 font-medium">
                      {r.country || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>
              {start + 1}–{Math.min(start + pageSize, rows.length)} of {rows.length} requests
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="w-8 h-8 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              &#171;
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="px-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={15} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              &#187;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
