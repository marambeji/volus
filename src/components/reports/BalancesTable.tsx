import type { ReportBalanceRow } from '../../services/reportsApi';

export default function BalancesTable({ rows }: { rows: ReportBalanceRow[] }) {
  // Column set is derived from whatever leave types actually appear in the
  // data, rather than a hardcoded Annual/Sick/Unpaid list — keeps the table
  // correct if leave types are added/removed from a policy.
  const typeKeys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.balances)))).sort();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            <th className="py-3 px-4">Employee</th>
            <th className="py-3 px-4">Department</th>
            <th className="py-3 px-4">Country</th>
            {typeKeys.map((key) => (
              <th key={key} className="py-3 px-4 text-center capitalize">{key}</th>
            ))}
            <th className="py-3 px-4 text-center">Total Available</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-xs">
          {rows.length === 0 && (
            <tr>
              <td colSpan={4 + typeKeys.length} className="py-8 text-center text-slate-400">No employees found</td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.employeeId} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
              <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{r.employeeName}</td>
              <td className="py-3.5 px-4 text-slate-500">{r.department}</td>
              <td className="py-3.5 px-4 text-slate-500">{r.country ?? '—'}</td>
              {typeKeys.map((key) => (
                <td key={key} className="py-3.5 px-4 text-center font-semibold">
                  {r.balances[key] ? `${r.balances[key].available}d` : '—'}
                </td>
              ))}
              <td className="py-3.5 px-4 text-center font-extrabold text-violet-600 dark:text-violet-400">{r.totalAvailable}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
