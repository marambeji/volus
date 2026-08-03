import { useState, useEffect, useCallback } from 'react';
import { Plus, Minus, History, Wallet, Check, TrendingUp, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';
import type { LeaveTypeKey } from '../../types';
import SearchInput from '../components/ui/SearchInput';
import StatCard from '../components/ui/StatCard';
import HistoryDrawer from '../components/HistoryDrawer';
import SlideDrawer from '../components/ui/SlideDrawer';
import { adjustBalance, getLedgerEntries } from '../../services/balancesApi';
import { apiFetch } from '../../services/apiClient';

interface BalanceItem {
  leaveTypeId: string;
  code: string;
  name: string;
  entitlement: number;
  earned: number;
  adjustments: number;
  used: number;
  pending: number;
  available: number;
  remaining: number;
}

interface CalculatedResponse {
  employeeId: string;
  employeeName: string;
  balances: BalanceItem[];
}

interface LedgerEntry {
  id: string;
  leaveTypeId: string;
  leaveType?: { key: string; label: string };
  transactionType: string;
  transactionDate: string;
  signedAmount: number;
  resultingBalance: number;
  reason: string;
}

export default function BalanceManagement() {
  const { state, dispatch } = useAdmin();
  const [search, setSearch] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState('2026');
  const [filterType, setFilterType] = useState<LeaveTypeKey | 'all'>('all');

  const [balanceData, setBalanceData] = useState<CalculatedResponse | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const [adjustModal, setAdjustModal] = useState<{ empId: string; leaveTypeId: string; typeName: string } | null>(null);
  const [adjustVal, setAdjustVal] = useState(1);
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustReason, setAdjustReason] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ entityType: string; entityId: string; name: string } | null>(null);

  const filteredEmps = state.employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  // Auto-select first employee once backend employees are loaded
  useEffect(() => {
    if (!selectedEmpId && state.employees.length > 0) {
      const first = state.employees[0];
      setSelectedEmpId(String(first.id));
    }
  }, [state.employees, selectedEmpId]);

  // Fetch calculated balances from backend when employee or year changes
  const fetchBalances = useCallback(async () => {
    if (!selectedEmpId) return;
    setLoading(true);
    try {
      const data = await apiFetch<CalculatedResponse>(
        `/leave-balances/employee/${selectedEmpId}?year=${filterYear}`
      );
      setBalanceData(data);
    } catch (err) {
      console.error('[BalanceManagement] Failed to fetch balances:', err);
      setBalanceData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedEmpId, filterYear]);

  // Fetch ledger entries from backend
  const fetchLedger = useCallback(async () => {
    if (!selectedEmpId) return;
    setLedgerLoading(true);
    try {
      const entries = await getLedgerEntries({
        employeeId: selectedEmpId,
        year: Number(filterYear),
        limit: 200,
      });
      setLedgerData(entries);
    } catch (err) {
      console.error('[BalanceManagement] Failed to fetch ledger:', err);
      setLedgerData([]);
    } finally {
      setLedgerLoading(false);
    }
  }, [selectedEmpId, filterYear]);

  useEffect(() => {
    void fetchBalances();
    void fetchLedger();
  }, [fetchBalances, fetchLedger]);

  // Derive UI-level summary metrics from calculated balances
  const allBalances: BalanceItem[] = balanceData?.balances ?? [];

  const selectedTypeBalance: BalanceItem | undefined =
    filterType === 'all'
      ? allBalances.find(b => b.code === 'annual')
      : allBalances.find(b => b.code === filterType);

  const earnedDays   = selectedTypeBalance?.earned      ?? 0;
  const usedDays     = selectedTypeBalance?.used        ?? 0;
  const adjustments  = selectedTypeBalance?.adjustments ?? 0;
  const remainingBal = selectedTypeBalance?.remaining   ?? selectedTypeBalance?.available ?? 0;

  // Filter ledger for display
  const displayedLedger = ledgerData.filter(l => {
    const matchType = filterType === 'all'
      ? true
      : (l.leaveType?.key === filterType);
    return matchType;
  });

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustModal) return;

    const absAmount = Math.abs(adjustVal);
    if (!absAmount || isNaN(absAmount)) {
      setAdjustError('Adjustment amount cannot be zero.');
      return;
    }
    if (!adjustReason.trim() || adjustReason.trim().length < 3) {
      setAdjustError('Reason must be at least 3 characters long (e.g. Carry-over correction).');
      return;
    }

    const finalAmount = adjustType === 'subtract' ? -absAmount : absAmount;
    setSubmittingAdjust(true);
    setAdjustError(null);

    try {
      await adjustBalance({
        employeeId: adjustModal.empId,
        leaveTypeId: adjustModal.leaveTypeId,
        year: Number(filterYear),
        amount: finalAmount,
        reason: adjustReason.trim(),
      });
      setToast(`Balance successfully adjusted (${finalAmount > 0 ? '+' : ''}${finalAmount}d)`);
      setAdjustModal(null);
      setAdjustVal(1);
      setAdjustReason('');
      await fetchBalances();
      await fetchLedger();
      setTimeout(() => setToast(null), 3500);
    } catch (err: any) {
      console.error('[handleAdjust] Error:', err);
      const msg = err?.message || 'Failed to adjust balance.';
      setAdjustError(msg);
    } finally {
      setSubmittingAdjust(false);
    }
  }

  const activeEmp = selectedEmpId
    ? state.employees.find(e => String(e.id) === selectedEmpId)
    : null;

  const [accrualRunning, setAccrualRunning] = useState(false);



  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 relative">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300 rounded-xl shadow-lg">
          <Check size={16} />
          <span className="text-xs font-semibold">{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Balance Management</h1>
          <p className="text-slate-400 text-sm mt-1">Adjust and monitor employee leave quotas</p>
        </div>
  
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Employee List */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm h-[calc(100vh-140px)] flex flex-col gap-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search employees..." />
          <div className="flex-1 overflow-y-auto pr-2 space-y-1">
            {filteredEmps.map(emp => (
              <button
                key={emp.id}
                onClick={() => setSelectedEmpId(String(emp.id))}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center gap-3 ${
                  selectedEmpId === String(emp.id)
                    ? 'bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                  selectedEmpId === String(emp.id) ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {emp.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <p className={`text-sm font-bold truncate ${
                    selectedEmpId === String(emp.id) ? 'text-violet-700 dark:text-violet-300' : 'text-slate-700 dark:text-slate-200'
                  }`}>{emp.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{emp.department}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Balance Grid & Ledger */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {activeEmp ? (
            <>
              {/* Profile Card & Filters */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-indigo-500 rounded-xl flex items-center justify-center text-white text-lg font-black">
                      {activeEmp.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">{activeEmp.name}</h2>
                        <button
                          onClick={() => setHistoryTarget({ entityType: 'Employee', entityId: String(activeEmp.id), name: activeEmp.name })}
                          className="p-1 text-slate-400 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-md transition-colors"
                          title="View Employee Audit History"
                        >
                          <History size={14} />
                        </button>
                        <button
                          onClick={() => { void fetchBalances(); void fetchLedger(); }}
                          className="p-1 text-slate-400 hover:text-violet-600 bg-slate-100 hover:bg-violet-50 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-md transition-colors"
                          title="Refresh balances"
                        >
                          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                      </div>
                      <p className="text-sm text-slate-500">{activeEmp.position} · {activeEmp.country}</p>
                    </div>
                  </div>

                  {/* Filters Bar */}
                  <div className="flex gap-3">
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Filter size={8}/>Year</label>
                      <select
                        value={filterYear}
                        onChange={e => setFilterYear(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none"
                      >
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
                        <option value="2024">2024</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Filter size={8}/>Leave Type</label>
                      <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value as any)}
                        className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none capitalize"
                      >
                        <option value="all">All Leave Types</option>
                        {allBalances.map(b => (
                          <option key={b.leaveTypeId} value={b.code}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Statistics Cards */}
                {loading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[0,1,2,3].map(i => (
                      <div key={i} className="h-20 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Earned Days"       value={`${earnedDays}d`}                                              color="bg-emerald-500" icon={<TrendingUp size={16}/>} />
                    <StatCard title="Used Days"         value={`${usedDays}d`}                                                color="bg-rose-500"    icon={<Wallet size={16}/>} />
                    <StatCard title="Adjustments"       value={`${adjustments > 0 ? '+' : ''}${adjustments}d`}               color="bg-amber-500"   icon={<History size={16}/>} />
                    <StatCard title="Remaining Balance" value={`${remainingBal}d`}                                            color="bg-violet-600"  icon={<Check size={16}/>} />
                  </div>
                )}
              </div>

              {/* Quotas List from backend */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="font-bold text-slate-800 dark:text-white mb-4 text-sm">Quotas List (Available Balance)</h3>
                {loading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[0,1,2,3,4,5,6,7].map(i => (
                      <div key={i} className="h-24 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : allBalances.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No leave balances found for this employee.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {allBalances.map(b => (
                      <div key={b.leaveTypeId} className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-100/50 dark:border-slate-600 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{b.name}</span>
                          <span className="text-xl font-extrabold text-slate-800 dark:text-white">{b.available}d</span>
                        </div>
                        <p className="text-[9px] text-slate-400 mb-3">
                          {b.entitlement}d entitlement · {b.used}d used
                          {b.pending > 0 ? ` · ${b.pending}d pending` : ''}
                        </p>
                        <button
                          onClick={() => {
                            setAdjustModal({ empId: String(activeEmp.id), leaveTypeId: b.leaveTypeId, typeName: b.name });
                            setAdjustReason('');
                            setAdjustVal(0);
                          }}
                          className="w-full bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 text-slate-600 dark:text-slate-300 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-500 transition-colors"
                        >
                          <Plus size={10}/> <Minus size={10}/> Adjust Balance
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ledger from backend */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-slate-400" />
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">Transaction Ledger ({filterYear})</h3>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Leave Type</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3 text-right">Change</th>
                        <th className="py-2.5 px-3 text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                      {ledgerLoading ? (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-400 text-xs">Loading transactions...</td></tr>
                      ) : displayedLedger.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-400 text-xs">No transactions recorded for this period</td></tr>
                      ) : (
                        displayedLedger.map(l => (
                          <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                            <td className="py-3 px-3 text-xs text-slate-500">
                              {new Date(l.transactionDate).toLocaleDateString('en-GB')}
                            </td>
                            <td className="py-3 px-3 text-xs font-semibold capitalize text-slate-600 dark:text-slate-300">
                              {l.transactionType.replace(/_/g, ' ').toLowerCase()}
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-500">
                              {l.leaveType?.label ?? '—'}
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-500">{l.reason || '—'}</td>
                            <td className={`py-3 px-3 text-xs font-bold text-right ${
                              Number(l.signedAmount) > 0 ? 'text-emerald-500' : Number(l.signedAmount) < 0 ? 'text-red-500' : 'text-slate-500'
                            }`}>
                              {Number(l.signedAmount) > 0 ? '+' : ''}{Number(l.signedAmount)}
                            </td>
                            <td className="py-3 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 text-right">
                              {Number(l.resultingBalance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm flex items-center justify-center h-48 text-slate-400 text-sm">
              Select an employee from the list to view and manage their balances.
            </div>
          )}
        </div>
      </div>

      {/* Adjust SlideDrawer (Replaces Pop-up) */}
      <SlideDrawer
        isOpen={!!adjustModal}
        onClose={() => {
          setAdjustModal(null);
          setAdjustError(null);
          setAdjustVal(1);
          setAdjustReason('');
        }}
        title="Adjust Leave Balance"
        subtitle={adjustModal ? `${activeEmp?.name || ''} — ${adjustModal.typeName}` : ''}
        width="max-w-lg"
      >
        {adjustModal && (
          <form onSubmit={handleAdjust} className="flex flex-col gap-6">
            {adjustError && (
              <div className="bg-red-50 text-red-600 p-3.5 rounded-xl border border-red-100 flex items-start gap-2.5 text-xs font-medium">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                <p>{adjustError}</p>
              </div>
            )}

            {/* Action Type Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Adjustment Action
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustType('add')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                    adjustType === 'add'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-700'
                  }`}
                >
                  <Plus size={16} />
                  Add Days (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('subtract')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                    adjustType === 'subtract'
                      ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-700'
                  }`}
                >
                  <Minus size={16} />
                  Deduct Days (-)
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Quick Select
              </label>
              <div className="flex flex-wrap gap-2">
                {[0.5, 1, 2, 3, 5, 10].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAdjustVal(preset)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      adjustVal === preset
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {adjustType === 'add' ? '+' : '-'}{preset} day{preset > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Number Input */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Number of Days *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  required
                  value={adjustVal || ''}
                  onChange={(e) => setAdjustVal(Math.abs(Number(e.target.value)))}
                  placeholder="e.g. 1.5"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-black text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <span className="absolute right-4 top-3 text-xs font-bold text-slate-400">Days</span>
              </div>
            </div>

            {/* Quick Reason Presets & Reason Input */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Reason *
              </label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {['Carry-over adjustment', 'Manual HR adjustment', 'Policy correction', 'Annual leave grant'].map(
                  (r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAdjustReason(r)}
                      className="text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      {r}
                    </button>
                  )
                )}
              </div>
              <textarea
                required
                rows={3}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Type reason for adjustment (e.g. Approved manual correction by HR)..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Live Calculation Preview Box */}
            {selectedTypeBalance && (
              <div className="p-4 bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Current Available:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 ml-1.5">
                    {selectedTypeBalance.available}d
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-medium">Resulting Balance:</span>
                  <span
                    className={`font-black text-sm ml-1.5 ${
                      adjustType === 'add' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {selectedTypeBalance.available + (adjustType === 'add' ? (Number(adjustVal) || 0) : -(Number(adjustVal) || 0))}d
                  </span>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setAdjustModal(null)}
                className="flex-1 py-3 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAdjust || !adjustVal || adjustVal <= 0 || adjustReason.trim().length < 3}
                className="flex-1 py-3 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50"
              >
                {submittingAdjust ? 'Applying...' : 'Apply Adjustment'}
              </button>
            </div>
          </form>
        )}
      </SlideDrawer>

      {/* Audit History Drawer */}
      <HistoryDrawer
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        entityType={historyTarget?.entityType || ''}
        entityId={historyTarget?.entityId || ''}
        entityName={historyTarget?.name}
      />
    </div>
  );
}
