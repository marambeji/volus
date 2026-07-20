import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import SearchInput from '../components/ui/SearchInput';
import { SelectFilter } from '../components/ui/SelectFilter';

export default function AuditLog() {
  const { state } = useAdmin();
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const actions = [...new Set(state.auditLog.map(l => l.action))];

  const filtered = state.auditLog.filter(l => 
    l.description.toLowerCase().includes(search.toLowerCase()) &&
    (!filterAction || l.action === filterAction)
  );

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Audit Log</h1>
          <p className="text-slate-400 text-sm mt-1">Track all system actions and modifications</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48"><SearchInput value={search} onChange={setSearch} placeholder="Search log description..." /></div>
        <SelectFilter label="Action Type" value={filterAction} onChange={setFilterAction} options={actions.map(a => ({ label: a, value: a }))} />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 text-[11px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 dark:bg-slate-800/50">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Entity</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4 text-xs">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {filtered.map(log => (
              <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString('en-GB')}</td>
                <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-200">{log.user}</td>
                <td className="py-3.5 px-4"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-bold">{log.action}</span></td>
                <td className="py-3.5 px-4 text-xs text-slate-500">{log.entity} <span className="text-[10px] text-slate-400">#{log.entityId}</span></td>
                <td className="py-3.5 px-4 text-xs font-medium text-slate-800 dark:text-slate-200">{log.description}</td>
                <td className="py-3.5 px-4 text-[11px] text-slate-500">
                  {log.previousValue && log.newValue ? (
                    <span className="flex items-center gap-1.5"><span className="line-through">{log.previousValue}</span> <span>→</span> <span className="font-bold text-emerald-600">{log.newValue}</span></span>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
