import { useState } from 'react';
import { Download } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';
import SearchInput from '../components/ui/SearchInput';
import { SelectFilter } from '../components/ui/SelectFilter';

export default function AccrualHistory() {
  const { state } = useAdmin();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterTxType, setFilterTxType] = useState(''); // 'accrual' | 'adjustment' | 'usage' | ''

  const leaveTypes = [...new Set(state.leaveLedger.map(l => l.leaveType))];
  const years = [...new Set(state.leaveLedger.map(l => new Date(l.date).getFullYear().toString()))];

  const filtered = state.leaveLedger.filter(l => {
    const emp = state.employees.find(e => e.id === l.employeeId);
    const matchesEmployee = !search || emp?.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = !filterType || l.leaveType === filterType;
    const matchesYear = !filterYear || new Date(l.date).getFullYear().toString() === filterYear;
    
    let matchesTxType = true;
    if (filterTxType === 'accrual') {
      matchesTxType = l.change > 0 && l.description.toLowerCase().includes('accrual');
    } else if (filterTxType === 'usage') {
      matchesTxType = l.change < 0 && l.description.toLowerCase().includes('approved');
    } else if (filterTxType === 'adjustment') {
      matchesTxType = !l.description.toLowerCase().includes('accrual') && !l.description.toLowerCase().includes('approved');
    }

    return matchesEmployee && matchesType && matchesYear && matchesTxType;
  });

  function exportCsv() {
    const header = ['Employee', 'Date', 'Leave Type', 'Description', 'Used Days', 'Earned Days', 'Balance After'];
    const rows = filtered.map(l => {
      const emp = state.employees.find(e => e.id === l.employeeId);
      return [
        emp?.name ?? 'Unknown',
        l.date,
        l.leaveType,
        l.description,
        l.change < 0 ? Math.abs(l.change).toString() : '0',
        l.change > 0 ? l.change.toString() : '0',
        l.balance.toString()
      ];
    });

    const csvContent = [header, ...rows].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `accrual_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Accrual History</h1>
          <p className="text-slate-400 text-sm mt-1">Detailed history of all leave accruals, manual adjustments, and leave usage transactions</p>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search employee..." />
        </div>
        <SelectFilter label="Leave Type" value={filterType} onChange={setFilterType} options={leaveTypes.map(t => ({ label: t.replace('_',' '), value: t }))} />
        <SelectFilter label="Year" value={filterYear} onChange={setFilterYear} options={years.map(y => ({ label: y, value: y }))} />
        <SelectFilter label="Transaction Type" value={filterTxType} onChange={setFilterTxType} options={[
          { label: 'Accruals Only', value: 'accrual' },
          { label: 'Adjustments Only', value: 'adjustment' },
          { label: 'Usages Only', value: 'usage' }
        ]} />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-[11px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 dark:bg-slate-800/50">
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Leave Type</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4 text-center">Used Days (-)</th>
                <th className="py-3.5 px-4 text-center">Earned Days (+)</th>
                <th className="py-3.5 px-4 text-center">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 text-sm">No transactions found</td>
                </tr>
              )}
              {filtered.map(l => {
                const emp = state.employees.find(e => e.id === l.employeeId);
                return (
                  <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 rounded-full flex items-center justify-center text-xs font-bold">
                          {emp?.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{emp?.name ?? 'Unknown Employee'}</p>
                          <p className="text-[9px] text-slate-400">{emp?.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(l.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 capitalize">
                      {l.leaveType.replace('_', ' ')}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                      {l.description}
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs font-bold text-red-500">
                      {l.change < 0 ? `${Math.abs(l.change)}d` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs font-bold text-emerald-500">
                      {l.change > 0 ? `+${l.change}d` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      {l.balance}d
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
