import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import type { ReportBalanceRow } from '../../services/reportsApi';
import Pagination from '../ui/Pagination';

export default function BalancesTable({ rows }: { rows: ReportBalanceRow[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Column set is derived from whatever leave types actually appear in the data
  const typeKeys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.balances)))).sort();

  // Reset to page 1 whenever rows change (e.g. search/filter applied)
  useEffect(() => {
    setCurrentPage(1);
  }, [rows]);

  const displayedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function renderBalanceCell(val?: number) {
    if (val === undefined || val === null) return <span className="text-slate-300 dark:text-slate-600">—</span>;
    if (val < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 font-black text-xs border border-red-200 dark:border-red-800">
          <AlertCircle size={10} className="text-red-500 flex-shrink-0" />
          {val}d
        </span>
      );
    }
    return <span className="font-semibold text-slate-700 dark:text-slate-200">{val}d</span>;
  }

  return (
    <div className="flex flex-col justify-between">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 px-4">Employee</th>
              <th className="py-3.5 px-4">Department</th>
              <th className="py-3.5 px-4">Country</th>
              {typeKeys.map((key) => (
                <th key={key} className="py-3.5 px-4 text-center capitalize">{key}</th>
              ))}
              <th className="py-3.5 px-4 text-center">Total Available</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4 + typeKeys.length} className="py-10 text-center text-slate-400 font-medium">
                  No employees found matching filter
                </td>
              </tr>
            ) : (
              displayedRows.map((r) => {
                const isTotalNegative = (r.totalAvailable ?? 0) < 0;
                return (
                  <tr key={r.employeeId} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {r.employeeName.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{r.employeeName}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-medium">{r.department || '—'}</td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-medium">{r.country ?? '—'}</td>
                    {typeKeys.map((key) => (
                      <td key={key} className="py-3.5 px-4 text-center">
                        {r.balances[key] ? renderBalanceCell(r.balances[key].available) : '—'}
                      </td>
                    ))}
                    <td className="py-3.5 px-4 text-center">
                      {isTotalNegative ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-black text-xs border border-red-300 dark:border-red-800 shadow-xs">
                          <AlertCircle size={12} className="text-red-500" />
                          {r.totalAvailable}d
                        </span>
                      ) : (
                        <span className="font-extrabold text-violet-600 dark:text-violet-400 text-sm">
                          {r.totalAvailable}d
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
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
