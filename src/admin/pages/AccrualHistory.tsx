import { useState, useEffect, useCallback, useRef } from 'react';
import { Download, RefreshCw, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getLedgerHistory, type AccrualHistoryRow } from '../../services/balancesApi';
import { getLeaveTypes, type LeaveTypeItem } from '../../services/leaveTypesApi';
import type { PaginatedMeta } from '../../services/apiClient';
import SearchInput from '../components/ui/SearchInput';
import { SelectFilter } from '../components/ui/SelectFilter';

// ── Transaction type badge colours ────────────────────────────────────────────
const TX_COLOURS: Record<string, string> = {
  INITIAL_GRANT: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
  ACCRUAL:       'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
  MANUAL_ADJUSTMENT: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300',
  USAGE:         'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300',
  REVERSAL:      'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300',
  CARRY_OVER:    'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300',
  RESET:         'bg-slate-50 text-slate-500 dark:bg-slate-700/40 dark:text-slate-300',
};

const TX_LABELS: Record<string, string> = {
  INITIAL_GRANT:     'Initial Grant',
  ACCRUAL:           'Accrual',
  MANUAL_ADJUSTMENT: 'Adjustment',
  USAGE:             'Usage',
  REVERSAL:          'Reversal',
  CARRY_OVER:        'Carry Over',
  RESET:             'Reset',
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const y = (CURRENT_YEAR - i).toString();
  return { label: y, value: y };
});

const TX_TYPE_OPTIONS = [
  { label: 'Initial Grant', value: 'INITIAL_GRANT' },
  { label: 'Accrual',       value: 'ACCRUAL' },
  { label: 'Adjustment',    value: 'MANUAL_ADJUSTMENT' },
  { label: 'Usage',         value: 'USAGE' },
  { label: 'Reversal',      value: 'REVERSAL' },
  { label: 'Carry Over',    value: 'CARRY_OVER' },
];

const PAGE_SIZE = 20;

export default function AccrualHistory() {
  // ── Filter state ────────────────────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [filterLeaveType, setFilterLeaveType] = useState('');   // leaveTypeId
  const [filterYear, setFilterYear]   = useState('');
  const [filterTxType, setFilterTxType] = useState('');

  // ── Data state ──────────────────────────────────────────────────────────────
  const [rows, setRows]       = useState<AccrualHistoryRow[]>([]);
  const [meta, setMeta]       = useState<PaginatedMeta | null>(null);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // ── Leave types for dropdown ────────────────────────────────────────────────
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);

  // debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterLeaveType, filterYear, filterTxType]);

  // Load leave types once
  useEffect(() => {
    getLeaveTypes().then(setLeaveTypes).catch(() => {});
  }, []);

  // Main data fetch
  const fetchHistory = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getLedgerHistory(
        {
          search:          debouncedSearch || undefined,
          leaveTypeId:     filterLeaveType || undefined,
          year:            filterYear ? Number(filterYear) : undefined,
          transactionType: filterTxType || undefined,
          page,
          limit:           PAGE_SIZE,
        },
        signal
      );
      setRows(res.data);
      setMeta(res.meta);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setError('Failed to load accrual history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterLeaveType, filterYear, filterTxType, page]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchHistory(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchHistory]);

  // ── CSV export (currently filtered, all pages — fetch with high limit) ──────
  async function exportCsv() {
    try {
      const res = await getLedgerHistory({
        search:          debouncedSearch || undefined,
        leaveTypeId:     filterLeaveType || undefined,
        year:            filterYear ? Number(filterYear) : undefined,
        transactionType: filterTxType || undefined,
        page:  1,
        limit: 5000,
      });
      const header = ['Employee', 'Job Title', 'Department', 'Date', 'Leave Type', 'Transaction Type', 'Description', 'Used Days', 'Earned Days', 'Balance After', 'Created By'];
      const csvRows = res.data.map(r => [
        r.employeeName,
        r.jobTitle ?? '',
        r.departmentName ?? '',
        new Date(r.createdAt).toLocaleDateString('en-GB'),
        r.leaveTypeName,
        TX_LABELS[r.transactionType] ?? r.transactionType,
        r.description,
        r.usedDays > 0 ? r.usedDays.toFixed(2) : '0',
        r.earnedDays > 0 ? r.earnedDays.toFixed(2) : '0',
        r.balanceAfter.toFixed(2),
        r.createdBy,
      ]);
      const content = [header, ...csvRows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `accrual_history_${new Date().toISOString().split('T')[0]}.csv`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert('Export failed. Please try again.');
    }
  }

  const leaveTypeOptions = leaveTypes.map(lt => ({ label: lt.label, value: lt.id }));
  const totalPages = meta?.totalPages ?? 1;

  // avatar initials
  function initials(name: string) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Accrual History</h1>
          <p className="text-slate-400 text-sm mt-1">
            Detailed history of all leave accruals, manual adjustments, and leave usage transactions
            {meta && (
              <span className="ml-2 text-slate-300">— {meta.total.toLocaleString()} records</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchHistory()}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 font-semibold px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search employee..." />
        </div>
        <SelectFilter
          label="Leave Type"
          value={filterLeaveType}
          onChange={setFilterLeaveType}
          options={leaveTypeOptions}
        />
        <SelectFilter
          label="Year"
          value={filterYear}
          onChange={setFilterYear}
          options={YEAR_OPTIONS}
        />
        <SelectFilter
          label="Transaction Type"
          value={filterTxType}
          onChange={setFilterTxType}
          options={TX_TYPE_OPTIONS}
        />
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
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4 text-center">Used Days (-)</th>
                <th className="py-3.5 px-4 text-center">Earned Days (+)</th>
                <th className="py-3.5 px-4 text-center">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {/* Loading state */}
              {loading && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                      <Loader2 size={18} className="animate-spin" />
                      Loading accrual history…
                    </div>
                  </td>
                </tr>
              )}

              {/* Error state */}
              {!loading && error && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-red-400 text-sm">
                      <AlertCircle size={24} />
                      {error}
                    </div>
                  </td>
                </tr>
              )}

              {/* Empty state */}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 text-sm">
                    No transactions found
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!loading && !error && rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                  {/* Employee */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      {row.employeeAvatar ? (
                        <img
                          src={row.employeeAvatar}
                          alt={row.employeeName}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {initials(row.employeeName)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{row.employeeName}</p>
                        <p className="text-[9px] text-slate-400">{row.departmentName ?? row.jobTitle ?? ''}</p>
                      </div>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </td>

                  {/* Leave Type */}
                  <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                    {row.leaveTypeName}
                  </td>

                  {/* Description */}
                  <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
                    {row.description}
                  </td>

                  {/* Transaction type badge */}
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${TX_COLOURS[row.transactionType] ?? 'bg-slate-100 text-slate-500'}`}>
                      {TX_LABELS[row.transactionType] ?? row.transactionType}
                    </span>
                  </td>

                  {/* Used Days */}
                  <td className="py-3.5 px-4 text-center text-xs font-bold text-red-500">
                    {row.usedDays > 0 ? `-${row.usedDays % 1 === 0 ? row.usedDays : row.usedDays.toFixed(2)}d` : '—'}
                  </td>

                  {/* Earned Days */}
                  <td className="py-3.5 px-4 text-center text-xs font-bold text-emerald-500">
                    {row.earnedDays > 0 ? `+${row.earnedDays % 1 === 0 ? row.earnedDays : row.earnedDays.toFixed(2)}d` : '—'}
                  </td>

                  {/* Balance After */}
                  <td className="py-3.5 px-4 text-center text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    {row.balanceAfter % 1 === 0 ? row.balanceAfter : row.balanceAfter.toFixed(2)}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-400">
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, meta.total)} of {meta.total.toLocaleString()} results
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                      pageNum === page
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
