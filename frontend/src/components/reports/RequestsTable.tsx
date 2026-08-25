import { useState, useEffect } from 'react';
import type { ReportRequestRow } from '../../services/reportsApi';
import Pagination from '../ui/Pagination';

const statusStyle: Record<string, string> = {
  APPROVED: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  REJECTED: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
  CANCELLED: 'bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400',
  PENDING: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
};

export default function RequestsTable({ rows }: { rows: ReportRequestRow[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 whenever rows change (e.g. filters applied)
  useEffect(() => {
    setCurrentPage(1);
  }, [rows]);

  const displayedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex flex-col justify-between">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              <th className="py-3 px-4">Employee</th>
              <th className="py-3 px-4">Leave Type</th>
              <th className="py-3 px-4">Dates</th>
              <th className="py-3 px-4 text-center">Days</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4">Department</th>
              <th className="py-3 px-4">Country</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-xs">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">No requests found</td>
              </tr>
            ) : (
              displayedRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{r.employeeName}</td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{r.leaveTypeName}</td>
                  <td className="py-3.5 px-4 text-slate-500">
                    {new Date(r.startDate).toLocaleDateString('en-GB')} → {new Date(r.endDate).toLocaleDateString('en-GB')}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-slate-700 dark:text-slate-300">{r.durationDays}d</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${statusStyle[r.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">{r.department ?? '—'}</td>
                  <td className="py-3.5 px-4 text-slate-500">{r.country ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={rows.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}
