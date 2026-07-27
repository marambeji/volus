import { useState, useEffect, useCallback } from 'react';
import {
  Check, X, Search, FileSpreadsheet, ListTodo, RefreshCw,
  AlertTriangle, TrendingDown, Wallet, Clock, Calendar, User,
  ChevronRight,
} from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import { apiFetch } from '../services/apiClient';
import { getEmployees, type BackendEmployee } from '../services/employeesApi';
import { getLeaveTypes, type LeaveTypeItem } from '../services/leaveTypesApi';
import { getBalances, type BackendLeaveBalance } from '../services/balancesApi';

interface MyApprovalItem {
  stepInstanceId: string;
  requestId: string;
  stepOrder: number;
  approverType: string;
  employeeId: string;
  leaveTypeId: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  reason: string;
  submittedAt: string;
}

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

interface EmployeeBalanceMap {
  [employeeId: string]: BalanceItem[];
}

function ActionModal({
  open, title, subtitle, required, confirmLabel, confirmClass, onConfirm, onCancel,
}: {
  open: boolean; title: string; subtitle: string; required: boolean;
  confirmLabel: string; confirmClass: string;
  onConfirm: (comment: string) => void; onCancel: () => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(''); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700">
        <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-1">{title}</h3>
        <p className="text-sm text-slate-400 mb-5">{subtitle}</p>
        <textarea
          rows={3} value={text} onChange={e => setText(e.target.value)}
          placeholder={required ? 'Reason is required…' : 'Optional comment…'}
          className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
        />
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer transition-colors">
            Cancel
          </button>
          <button type="button" disabled={required && !text.trim()} onClick={() => onConfirm(text.trim())}
            className={`flex-1 py-2.5 text-sm font-bold text-white rounded-xl cursor-pointer disabled:opacity-40 transition-colors ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaveTypePill({ label }: { label: string }) {
  // Use the navy/blue palette as primary, neutral tones for the rest
  const colors: Record<string, string> = {
    annual:      'bg-[#1b2559]/10 text-[#1b2559] border border-[#1b2559]/20',
    sick:        'bg-rose-50 text-rose-700 border border-rose-200',
    maternity:   'bg-pink-50 text-pink-700 border border-pink-200',
    paternity:   'bg-sky-50 text-sky-700 border border-sky-200',
    bereavement: 'bg-slate-100 text-slate-600 border border-slate-200',
    wedding:     'bg-indigo-50 text-indigo-700 border border-indigo-200',
    unpaid:      'bg-slate-100 text-slate-500 border border-slate-200',
    compensation:'bg-teal-50 text-teal-700 border border-teal-200',
    overtime:    'bg-cyan-50 text-cyan-700 border border-cyan-200',
  };
  const key = label.toLowerCase().split(' ')[0];
  return (
    <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-[11px] font-bold ${colors[key] ?? 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
      {label}
    </span>
  );
}

export default function ApprovalDashboard() {
  const [activeTab, setActiveTab] = useState<'requests' | 'directs'>('requests');
  const [pendingApprovals, setPendingApprovals] = useState<MyApprovalItem[]>([]);
  const [directReports, setDirectReports] = useState<BackendEmployee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [balances, setBalances] = useState<BackendLeaveBalance[]>([]);
  const [employeeBalanceMap, setEmployeeBalanceMap] = useState<EmployeeBalanceMap>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingAction, setPendingAction] = useState<{ requestId: string; status: 'approved' | 'rejected' } | null>(null);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [approvalsData, employeesData, typesData, balancesData] = await Promise.all([
        apiFetch<MyApprovalItem[]>('/leave-requests/my-approvals', { signal }),
        getEmployees({ status: 'ACTIVE', limit: 1000 }, signal),
        getLeaveTypes(signal),
        getBalances({ limit: 1000 }, signal),
      ]);
      const approvals = approvalsData || [];
      setPendingApprovals(approvals);
      setLeaveTypes(typesData || []);
      setBalances(balancesData || []);
      const directs = currentUser?.id
        ? (employeesData || []).filter((e) => e.managerId === currentUser.id)
        : [];
      setDirectReports(directs);

      // Fetch calculated balances for all relevant employees:
      // – employees who have pending approval requests
      // – direct reports shown in the Directs Balance tab
      const approvalEmpIds = approvals.map((a) => a.employeeId).filter(Boolean);
      const directEmpIds = directs.map((d) => d.id);
      const uniqueIds = [...new Set([...approvalEmpIds, ...directEmpIds])];

      if (uniqueIds.length > 0 && !signal?.aborted) {
        const entries = await Promise.all(
          uniqueIds.map((empId) =>
            apiFetch<{ balances: BalanceItem[] }>(`/leave-balances/employee/${empId}`)
              .then((res) => ({ empId, balances: res.balances || [] }))
              .catch(() => ({ empId, balances: [] }))
          )
        );
        const map: EmployeeBalanceMap = {};
        entries.forEach(({ empId, balances }) => { map[empId] = balances; });
        setEmployeeBalanceMap(map);
      }
    } catch (err) {
      console.error('Failed to load approval dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void loadData(ctrl.signal);
    return () => ctrl.abort();
  }, [loadData]);

  async function confirmAction(comment: string) {
    if (!pendingAction) return;
    const { requestId, status } = pendingAction;
    setPendingAction(null);
    setActionLoading(requestId);
    try {
      if (status === 'approved') {
        await apiFetch<any>(`/leave-requests/${requestId}/approve`, { method: 'PUT', body: JSON.stringify({ comment }) });
      } else {
        await apiFetch<any>(`/leave-requests/${requestId}/reject`, { method: 'PUT', body: JSON.stringify({ reason: comment }) });
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setActionLoading(null);
    }
  }

  const filteredDirects = directReports.filter(r =>
    r.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="py-20 text-center text-slate-400 text-sm flex justify-center items-center gap-2">
      <RefreshCw size={18} className="animate-spin text-violet-500" /> Loading…
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <ActionModal
        open={pendingAction !== null}
        title={pendingAction?.status === 'approved' ? 'Confirm Approval' : 'Reject Request'}
        subtitle={pendingAction?.status === 'approved'
          ? 'Add an optional comment visible to the employee.'
          : 'A rejection reason is required and will be sent to the employee.'}
        required={pendingAction?.status === 'rejected'}
        confirmLabel={pendingAction?.status === 'approved' ? '✓ Approve' : '✕ Reject'}
        confirmClass={pendingAction?.status === 'approved'
          ? 'bg-emerald-600 hover:bg-emerald-700'
          : 'bg-red-600 hover:bg-red-700'}
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">Approval Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Review and action your direct reports' leave requests</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-end">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'requests'
                ? 'bg-[#1b2559] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ListTodo size={14} />
            Requests
            {pendingApprovals.length > 0 && (
              <span className="bg-white/30 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                {pendingApprovals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('directs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'directs'
                ? 'bg-[#1b2559] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FileSpreadsheet size={14} />
            Directs Balance
          </button>
        </div>
      </div>

      {activeTab === 'requests' ? (
        <div className="flex flex-col gap-4">
          {pendingApprovals.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
              <EmptyState
                title="All clear — no pending requests"
                message="Your team's requests have all been handled. Check back later."
                icon="🎉"
              />
            </div>
          ) : (
            pendingApprovals.map((req) => {
              const empBalances = employeeBalanceMap[req.employeeId] ?? [];
              const typeBalance = empBalances.find(b => b.leaveTypeId === req.leaveTypeId);
              const available = typeBalance?.available ?? null;
              const entitlement = typeBalance?.entitlement ?? 0;
              const used = typeBalance?.used ?? 0;
              const requested = Number(req.durationDays);
              const balanceAfter = available !== null ? available - requested : null;
              const isOverdraft = balanceAfter !== null && balanceAfter < 0;
              const usedPct = entitlement > 0 ? Math.min(100, Math.round(((used + (isOverdraft ? requested : 0)) / entitlement) * 100)) : 0;
              const usedNormPct = entitlement > 0 ? Math.min(100, Math.round((used / entitlement) * 100)) : 0;

              return (
                <div
                  key={req.requestId}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all hover:shadow-md"
                >
                  {/* Top accent — always navy gradient */}
                  <div className="h-1 w-full bg-gradient-to-r from-[#1b2559] to-[#374ab0]" />

                  <div className="p-6">
                    {/* Row 1: Employee + Leave type */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                      <div className="flex items-center gap-4">
                        <Avatar name={req.employeeName || '?'} size="lg" />
                        <div>
                          <h3 className="text-base font-bold text-slate-800 dark:text-white">{req.employeeName}</h3>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <User size={10} /> Step {req.stepOrder} · {req.approverType}
                          </p>
                          {req.reason && (
                            <p className="text-xs text-slate-500 italic mt-1.5 max-w-xs">"{req.reason}"</p>
                          )}
                        </div>
                      </div>

                      <div className="text-left sm:text-right flex-shrink-0">
                        <LeaveTypePill label={req.leaveTypeName || 'Leave'} />
                        <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:justify-end">
                          <Calendar size={12} className="text-slate-400" />
                          {new Date(req.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          <ChevronRight size={10} className="text-slate-400" />
                          {new Date(req.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 sm:text-right">
                          {req.durationDays} chargeable {req.durationDays === 1 ? 'day' : 'days'}
                        </p>
                        <p className="text-[10px] text-slate-300 dark:text-slate-500 mt-1">
                          Submitted {new Date(req.submittedAt).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </div>

                    {/* ── Balance Panel ── */}
                    <div className="rounded-xl px-5 py-4 mb-5 bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-600">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          {typeBalance ? typeBalance.name : req.leaveTypeName} Balance
                        </span>
                        {isOverdraft ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 px-2 py-0.5 rounded-full">
                            <AlertTriangle size={10} /> Insufficient
                          </span>
                        ) : available !== null ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 px-2 py-0.5 rounded-full">
                            ✓ Sufficient
                          </span>
                        ) : null}
                      </div>

                      {/* 3-column stats */}
                      <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-600 mb-4">
                        <div className="pr-4 text-center">
                          <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1 mb-1">
                            <Wallet size={9} /> Available
                          </p>
                          <p className={`text-2xl font-extrabold ${
                            available !== null && available < requested
                              ? 'text-amber-500'
                              : 'text-slate-800 dark:text-white'
                          }`}>
                            {available !== null ? available : '—'}<span className="text-sm font-bold">d</span>
                          </p>
                        </div>
                        <div className="px-4 text-center">
                          <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1 mb-1">
                            <Clock size={9} /> Requested
                          </p>
                          <p className="text-2xl font-extrabold text-blue-500">
                            -{requested}<span className="text-sm font-bold">d</span>
                          </p>
                        </div>
                        <div className="pl-4 text-center">
                          <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1 mb-1">
                            <TrendingDown size={9} /> After
                          </p>
                          <p className={`text-2xl font-extrabold ${
                            isOverdraft ? 'text-red-500 dark:text-red-400' : 'text-emerald-500'
                          }`}>
                            {balanceAfter !== null ? balanceAfter : '—'}<span className="text-sm font-bold">d</span>
                          </p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      {entitlement > 0 && (
                        <>
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
                            <span>Used <span className="font-semibold text-slate-600 dark:text-slate-300">{used}d</span> of <span className="font-semibold text-slate-600 dark:text-slate-300">{entitlement}d</span> entitlement</span>
                            <span className="font-semibold">{usedNormPct}%</span>
                          </div>
                          <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all bg-gradient-to-r from-[#1b2559] to-[#374ab0]"
                              style={{ width: `${usedNormPct}%` }}
                            />
                          </div>
                          {isOverdraft && (
                            <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-2 flex items-center gap-1">
                              <AlertTriangle size={10} /> Approving will create a deficit of {Math.abs(balanceAfter!)} day{Math.abs(balanceAfter!) > 1 ? 's' : ''}.
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Row 3: Action buttons */}
                    <div className="flex items-center justify-end gap-3">
                      <button
                        disabled={actionLoading !== null}
                        onClick={() => setPendingAction({ requestId: req.requestId, status: 'rejected' })}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-800 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <X size={15} /> Decline
                      </button>
                      <button
                        disabled={actionLoading !== null}
                        onClick={() => setPendingAction({ requestId: req.requestId, status: 'approved' })}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-40 shadow-sm"
                      >
                        <Check size={15} />
                        {isOverdraft ? 'Approve Anyway' : 'Approve'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Directs Balance */
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden p-6">
          <div className="relative max-w-sm mb-6">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Search direct report…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  <th className="py-3 px-4">Name</th>
                  {leaveTypes.map(t => (
                    <th key={t.id} className="py-3 px-4 text-center whitespace-nowrap">{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {filteredDirects.length === 0 ? (
                  <tr><td colSpan={leaveTypes.length + 1} className="py-10 text-center text-slate-400 text-xs">No direct reports found</td></tr>
                ) : filteredDirects.map(rep => (
                  <tr key={rep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={rep.fullName} size="sm" />
                        <div>
                          <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{rep.fullName}</p>
                          <p className="text-[10px] text-slate-400">{rep.department}</p>
                        </div>
                      </div>
                    </td>
                    {leaveTypes.map(type => {
                      // Use calculated balance map (same engine as Employee Portal)
                      const empCalc = employeeBalanceMap[rep.id] ?? [];
                      const b = empCalc.find(x => x.leaveTypeId === type.id);
                      const amount = b != null ? b.available : null;
                      const isNegative = amount !== null && amount < 0;
                      const isLow = amount !== null && amount <= 2 && amount >= 0;
                      return (
                        <td key={type.id} className="py-3 px-4 text-center">
                          {amount === null ? (
                            <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                          ) : (
                            <span className={`text-sm font-bold px-2.5 py-0.5 rounded-lg ${
                              isNegative
                                ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                : isLow
                                ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {amount}d
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
