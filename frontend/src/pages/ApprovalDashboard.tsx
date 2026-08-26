import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Check, X, Search, FileSpreadsheet, ListTodo, RefreshCw,
  AlertTriangle, Calendar, Users, ChevronDown, ChevronLeft, ChevronRight,
  Filter, ArrowUpDown, CheckCircle2, AlertCircle, ShieldAlert, Info
} from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import { apiFetch } from '../services/apiClient';
import { getEmployees, type BackendEmployee } from '../services/employeesApi';
import { getLeaveTypes, type LeaveTypeItem } from '../services/leaveTypesApi';

// Interfaces
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
  dayPortion?: string;
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
  requiresPositiveBalance?: boolean;
}

interface EmployeeBalanceMap {
  [employeeId: string]: BalanceItem[];
}

interface TeamAvailabilityMember {
  employeeId: string;
  employeeName: string;
  department: string;
  isRequester: boolean;
  onLeaveDuringPeriod: boolean;
  requests: {
    requestId: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    status: string;
    isCurrentRequest: boolean;
  }[];
}

interface TeamAvailabilityDay {
  date: string;
  onLeave: { employeeId: string; employeeName: string; leaveTypeName: string; status: string }[];
}

interface TeamAvailabilityResult {
  requestId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  windowStart: string;
  windowEnd: string;
  teamSize: number;
  impactCount: number;
  impactPercent: number;
  members: TeamAvailabilityMember[];
  timeline: TeamAvailabilityDay[];
}

function dayPortionLabel(dayPortion?: string): string | null {
  if (dayPortion === 'FIRST_HALF') return 'First Half';
  if (dayPortion === 'SECOND_HALF') return 'Second Half';
  return null;
}

// Leave Type Pill Component
function LeaveTypePill({ label }: { label: string }) {
  const colors: Record<string, string> = {
    annual: 'bg-[#1b2559]/10 text-[#1b2559] border-[#1b2559]/20 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    sick: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    maternity: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:border-pink-800',
    paternity: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
    bereavement: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    wedding: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
    unpaid: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    compensation: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
    overtime: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
  };
  const key = label.toLowerCase().split(' ')[0];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${colors[key] ?? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
      {label}
    </span>
  );
}

// Confirmation Action Modal
function ActionConfirmationModal({
  open,
  request,
  type,
  balanceItem,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  request: MyApprovalItem | null;
  type: 'approved' | 'rejected' | null;
  balanceItem: BalanceItem | undefined;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) setComment('');
  }, [open]);

  if (!open || !request || !type) return null;

  const isApprove = type === 'approved';
  const availableBalance = balanceItem?.available ?? null;
  const requested = Number(request.durationDays);
  const projectedBalance = availableBalance !== null ? availableBalance - requested : null;
  const isOverdraft = projectedBalance !== null && projectedBalance < 0;

  // Policy rule check: requiresPositiveBalance defaults to true (prohibits negative) unless explicitly set to false
  const requiresPositiveBalance = balanceItem?.requiresPositiveBalance ?? true;
  const isOverdraftProhibited = isOverdraft && requiresPositiveBalance;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-xs" onClick={loading ? undefined : onCancel} />
      <div className="fixed inset-y-0 right-0 z-[80] w-full max-w-lg bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700 flex flex-col">

        {/* Panel Header */}
        <div className={`p-5 border-b flex items-center justify-between flex-shrink-0 ${
          isApprove
            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
            : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50 text-rose-900 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
              isApprove ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
              {isApprove ? <Check size={20} /> : <X size={20} />}
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                {isApprove ? 'Confirm Leave Approval' : 'Decline Leave Request'}
              </h3>
              <p className="text-xs opacity-80 mt-0.5">
                {isApprove ? 'Review calculation and policy rules before finalizing' : 'State reason for declining this request'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Details Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm text-slate-700 dark:text-slate-200">
          
          {/* Request summary box */}
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200/80 dark:border-slate-600 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-base">{request.employeeName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{request.leaveTypeName}</p>
              </div>
              <LeaveTypePill label={request.leaveTypeName} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-slate-200/60 dark:border-slate-600">
              <div>
                <span className="text-slate-400 font-medium block text-xs">Requested Dates</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {new Date(request.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – {new Date(request.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block text-xs">Requested Duration</span>
                <span className="font-semibold text-[#1b2559] dark:text-indigo-300">
                  {request.durationDays} days
                  {dayPortionLabel(request.dayPortion) && ` (${dayPortionLabel(request.dayPortion)})`}
                </span>
              </div>
            </div>

            {/* Calculations Breakdown */}
            {availableBalance !== null && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-600 space-y-1 text.xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Current available balance:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{availableBalance} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Requested leave:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">−{requested} days</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-200/40 dark:border-slate-600">
                  <span className="text-slate-700 dark:text-slate-300">Projected balance:</span>
                  <span className={isOverdraft ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}>
                    {projectedBalance} days
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Overdraft Policy Notice Banner */}
          {isApprove && isOverdraft && (
            <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-xs sm:text-sm ${
              isOverdraftProhibited
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            }`}>
              {isOverdraftProhibited ? (
                <ShieldAlert size={18} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              ) : (
                <AlertCircle size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-bold text-sm">
                  {isOverdraftProhibited ? 'Overdraft Prohibited by Policy' : 'Overdraft Permitted'}
                </p>
                <p className="opacity-90 leading-relaxed">
                  {isOverdraftProhibited
                    ? 'Approval is blocked because the projected balance exceeds the authorised limit.'
                    : 'Overdraft permitted by the applicable policy.'}
                </p>
              </div>
            </div>
          )}

          {/* Comment input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isApprove ? 'Optional Comment for Employee' : 'Reason for Declining (Required)'}
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={isApprove ? 'Add an optional comment...' : 'Please explain why this request is declined...'}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1b2559] resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={loading || (!isApprove && !comment.trim()) || (isApprove && isOverdraftProhibited)}
            onClick={() => onConfirm(comment.trim())}
            className={`px-5 py-2 text-sm font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-2 ${
              isApprove
                ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300'
            }`}
          >
            {loading && <RefreshCw size={14} className="animate-spin" />}
            {isApprove ? 'Approve Request' : 'Decline Request'}
          </button>
        </div>
      </div>
    </>
  );
}

// MAIN DASHBOARD COMPONENT
export default function ApprovalDashboard() {
  const [activeTab, setActiveTab] = useState<'requests' | 'directs'>('requests');
  const [pendingApprovals, setPendingApprovals] = useState<MyApprovalItem[]>([]);
  const [directReports, setDirectReports] = useState<BackendEmployee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [employeeBalanceMap, setEmployeeBalanceMap] = useState<EmployeeBalanceMap>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Search, Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NORMAL' | 'OVERDRAFT'>('ALL');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'startDate_asc' | 'submittedAt_desc' | 'urgency' | 'duration_desc'>('startDate_asc');

  // Modal State
  const [activeActionModal, setActiveActionModal] = useState<{
    request: MyApprovalItem;
    type: 'approved' | 'rejected';
  } | null>(null);

  // Availability State
  const [availabilityOpen, setAvailabilityOpen] = useState<Record<string, boolean>>({});
  const [availabilityData, setAvailabilityData] = useState<Record<string, TeamAvailabilityResult | 'error'>>({});
  const [availabilityLoading, setAvailabilityLoading] = useState<Record<string, boolean>>({});

  // Helper date formatting
  const formatDateIso = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Standalone Overview Modal state
  const todayStr = formatDateIso(new Date());
  const future14 = new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10); // Exactly 14 calendar days
  const [overviewModalOpen, setOverviewModalOpen] = useState(false);
  const [overviewDateFrom, setOverviewDateFrom] = useState(todayStr);
  const [overviewDateTo, setOverviewDateTo] = useState(future14);
  const [activePreset, setActivePreset] = useState<'7' | '14' | '30' | 'month' | 'custom'>('14');
  const [overviewData, setOverviewData] = useState<TeamAvailabilityResult | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const matrixScrollRef = useRef<HTMLDivElement>(null);

  const setPresetRange = (days: number) => {
    const from = formatDateIso(new Date());
    const to = formatDateIso(new Date(Date.now() + (days - 1) * 86400000));
    setOverviewDateFrom(from);
    setOverviewDateTo(to);
    setActivePreset(String(days) as any);
  };

  const setThisMonthPreset = () => {
    const now = new Date();
    const from = formatDateIso(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = formatDateIso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    setOverviewDateFrom(from);
    setOverviewDateTo(to);
    setActivePreset('month');
  };

  useEffect(() => {
    if (overviewModalOpen) {
      async function fetchOverview() {
        setOverviewLoading(true);
        try {
          const res = await apiFetch<TeamAvailabilityResult>(
            `/leave-requests/team-availability/overview?dateFrom=${overviewDateFrom}&dateTo=${overviewDateTo}`
          );
          setOverviewData(res);
        } catch (err) {
          console.error('Failed to fetch team availability overview:', err);
        } finally {
          setOverviewLoading(false);
        }
      }
      void fetchOverview();
    }
  }, [overviewModalOpen, overviewDateFrom, overviewDateTo]);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [approvalsData, employeesData, typesData] = await Promise.all([
        apiFetch<MyApprovalItem[]>('/leave-requests/my-approvals', { signal }),
        getEmployees({ status: 'ACTIVE', limit: 1000 }, signal),
        getLeaveTypes(signal),
      ]);
      const approvals = approvalsData || [];
      setPendingApprovals(approvals);
      setLeaveTypes(typesData || []);

      const directs = currentUser?.id
        ? (employeesData || []).filter((e) => e.managerId === currentUser.id)
        : [];
      setDirectReports(directs);

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

  async function handleConfirmAction(comment: string) {
    if (!activeActionModal) return;
    const { request, type } = activeActionModal;
    const { requestId } = request;
    setActionLoading(requestId);
    try {
      if (type === 'approved') {
        await apiFetch<any>(`/leave-requests/${requestId}/approve`, { method: 'PUT', body: JSON.stringify({ comment }) });
      } else {
        await apiFetch<any>(`/leave-requests/${requestId}/reject`, { method: 'PUT', body: JSON.stringify({ reason: comment }) });
      }
      setActiveActionModal(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleTeamAvailability(requestId: string) {
    const willOpen = !availabilityOpen[requestId];
    setAvailabilityOpen(prev => ({ ...prev, [requestId]: willOpen }));
    if (willOpen && !availabilityData[requestId]) {
      setAvailabilityLoading(prev => ({ ...prev, [requestId]: true }));
      try {
        const data = await apiFetch<TeamAvailabilityResult>(`/leave-requests/${requestId}/team-availability`);
        setAvailabilityData(prev => ({ ...prev, [requestId]: data }));
      } catch (err) {
        console.error('Failed to load team availability', err);
        setAvailabilityData(prev => ({ ...prev, [requestId]: 'error' }));
      } finally {
        setAvailabilityLoading(prev => ({ ...prev, [requestId]: false }));
      }
    }
  }

  // Filtered and sorted requests calculation
  const processedRequests = useMemo(() => {
    let result = [...pendingApprovals];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.employeeName.toLowerCase().includes(q) ||
        (r.reason && r.reason.toLowerCase().includes(q)) ||
        r.leaveTypeName.toLowerCase().includes(q)
      );
    }

    if (leaveTypeFilter !== 'ALL') {
      result = result.filter(r => r.leaveTypeId === leaveTypeFilter);
    }

    if (statusFilter !== 'ALL') {
      result = result.filter(r => {
        const empBalances = employeeBalanceMap[r.employeeId] ?? [];
        const typeBalance = empBalances.find(b => b.leaveTypeId === r.leaveTypeId);
        const available = typeBalance?.available ?? null;
        const requested = Number(r.durationDays);
        const balanceAfter = available !== null ? available - requested : null;
        const isOverdraft = balanceAfter !== null && balanceAfter < 0;

        return statusFilter === 'OVERDRAFT' ? isOverdraft : !isOverdraft;
      });
    }

    result.sort((a, b) => {
      if (sortBy === 'startDate_asc') {
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      }
      if (sortBy === 'submittedAt_desc') {
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      }
      if (sortBy === 'duration_desc') {
        return b.durationDays - a.durationDays;
      }
      if (sortBy === 'urgency') {
        const aBalances = employeeBalanceMap[a.employeeId] ?? [];
        const aBal = aBalances.find(x => x.leaveTypeId === a.leaveTypeId)?.available ?? 0;
        const aOverdraft = (aBal - a.durationDays) < 0 ? 1 : 0;

        const bBalances = employeeBalanceMap[b.employeeId] ?? [];
        const bBal = bBalances.find(x => x.leaveTypeId === b.leaveTypeId)?.available ?? 0;
        const bOverdraft = (bBal - b.durationDays) < 0 ? 1 : 0;

        return bOverdraft - aOverdraft;
      }
      return 0;
    });

    return result;
  }, [pendingApprovals, searchQuery, leaveTypeFilter, statusFilter, sortBy, employeeBalanceMap]);

  const filteredDirects = directReports.filter(r =>
    r.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500 dark:text-slate-400 text-sm flex justify-center items-center gap-3">
        <RefreshCw size={20} className="animate-spin text-[#1b2559] dark:text-indigo-400" />
        <span>Loading approval dashboard...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      
      {/* Action Confirmation Modal */}
      <ActionConfirmationModal
        open={activeActionModal !== null}
        request={activeActionModal?.request || null}
        type={activeActionModal?.type || null}
        balanceItem={
          activeActionModal
            ? (employeeBalanceMap[activeActionModal.request.employeeId] ?? []).find(
                b => b.leaveTypeId === activeActionModal.request.leaveTypeId
              )
            : undefined
        }
        loading={actionLoading !== null}
        onConfirm={handleConfirmAction}
        onCancel={() => setActiveActionModal(null)}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Approval Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Review and manage your direct reports’ leave requests efficiently.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setOverviewModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-[#1b2559] hover:bg-[#28387a] text-white shadow-xs transition-all cursor-pointer hover:shadow-md"
          >
            <Users size={15} />
            <span>Team Schedule Overview</span>
          </button>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'requests'
                  ? 'bg-[#1b2559] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ListTodo size={14} />
              <span>Requests</span>
              {pendingApprovals.length > 0 && (
                <span className="bg-indigo-500/30 text-white text-[11px] font-black px-2 py-0.5 rounded-full leading-none ml-1">
                  {pendingApprovals.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('directs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'directs'
                  ? 'bg-[#1b2559] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>Directs Balance</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'requests' ? (
        <div className="space-y-4">
          
          {/* ── Filtering & Controls Bar ── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search employee, leave type, or reason..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1b2559]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                  ✕
                </button>
              )}
            </div>

            {/* Select Filters */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Filter size={13} className="text-slate-400" />
                <select
                  value={leaveTypeFilter}
                  onChange={e => setLeaveTypeFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1b2559]"
                >
                  <option value="ALL">All Leave Types</option>
                  {leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1b2559]"
              >
                <option value="ALL">All Risk Statuses</option>
                <option value="NORMAL">Normal Balance</option>
                <option value="OVERDRAFT">Overdraft Risk Only</option>
              </select>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <ArrowUpDown size={13} className="text-slate-400" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1b2559]"
                >
                  <option value="startDate_asc">Start Date (Earliest)</option>
                  <option value="submittedAt_desc">Submission (Newest)</option>
                  <option value="urgency">Overdraft Urgency</option>
                  <option value="duration_desc">Duration (Longest)</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Request List ── */}
          {processedRequests.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-xs">
              <EmptyState
                title={pendingApprovals.length === 0 ? "All clear — no pending requests" : "No matching requests found"}
                message={pendingApprovals.length === 0 ? "All leave requests for your direct reports have been processed." : "Try adjusting your filters or search criteria."}
                icon="🎉"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {processedRequests.map((req) => {
                const empBalances = employeeBalanceMap[req.employeeId] ?? [];
                const typeBalance = empBalances.find(b => b.leaveTypeId === req.leaveTypeId);
                const available = typeBalance?.available ?? null;
                const requested = Number(req.durationDays);
                const projectedBalance = available !== null ? available - requested : null;
                const isOverdraft = projectedBalance !== null && projectedBalance < 0;
                const isExhausted = projectedBalance !== null && projectedBalance === 0;

                // Policy overdraft rule check: defaults to requiring positive balance unless policy explicitly permits overdraft
                const requiresPositiveBalance = typeBalance?.requiresPositiveBalance ?? true;
                const isOverdraftProhibited = isOverdraft && requiresPositiveBalance;

                return (
                  <div
                    key={req.requestId}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs transition-all"
                  >
                    {/* 3-Column Grid Layout: minmax(320px, 0.9fr) minmax(480px, 1.2fr) minmax(250px, 0.65fr) with 24px gap */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(320px,0.9fr)_minmax(480px,1.2fr)_minmax(250px,0.65fr)] gap-6 items-center">
                      
                      {/* ── COL 1: Employee & Request Meta (minmax 320px) ── */}
                      <div className="flex items-start gap-3.5 min-w-0 max-w-md w-full">
                        <Avatar name={req.employeeName || '?'} size="md" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                              {req.employeeName}
                            </h3>
                            <LeaveTypePill label={req.leaveTypeName || 'Leave'} />
                          </div>

                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 flex-wrap">
                            <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                              <Calendar size={14} className="text-slate-400" />
                              {new Date(req.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              {' → '}
                              {new Date(req.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="font-extrabold text-[#1b2559] dark:text-indigo-300">
                              {req.durationDays} {req.durationDays === 1 ? 'day' : 'days'}
                            </span>
                            {dayPortionLabel(req.dayPortion) && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                                  {dayPortionLabel(req.dayPortion)}
                                </span>
                              </>
                            )}
                          </div>

                          {req.reason && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic truncate max-w-md">
                              "{req.reason}"
                            </p>
                          )}

                          <div className="flex items-center gap-2 text-xs text-slate-400 pt-0.5">
                            <span>Step {req.stepOrder} ({req.approverType})</span>
                            <span>•</span>
                            <span>Submitted {new Date(req.submittedAt).toLocaleDateString('en-GB')}</span>
                          </div>
                        </div>
                      </div>

                      {/* ── COL 2: Annual Leave Balance Panel (480px - 540px) ── */}
                      <div className="w-full max-w-[540px] lg:min-w-[480px] bg-slate-50/80 dark:bg-slate-700/40 p-4.5 lg:p-5 rounded-xl border border-slate-200/80 dark:border-slate-600/70 space-y-3">
                        
                        {/* Title & Overdraft Status Badge Aligned */}
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                            {(typeBalance ? typeBalance.name : req.leaveTypeName).toUpperCase()} BALANCE
                          </span>
                          
                          {/* Overdraft / Status Pill */}
                          {isOverdraft ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-800">
                              <AlertCircle size={13} /> OVERDRAFT
                            </span>
                          ) : isExhausted ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                              <AlertTriangle size={13} /> EXHAUSTED
                            </span>
                          ) : available !== null ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md">
                              <CheckCircle2 size={13} /> SUFFICIENT
                            </span>
                          ) : null}
                        </div>

                        {/* Calculation Rows */}
                        <div className="space-y-2 text-sm pt-2 border-t border-slate-200/60 dark:border-slate-600">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Current available balance:</span>
                            <span className="text-[15px] font-bold text-slate-800 dark:text-slate-100">
                              {available !== null ? `${available} days` : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Requested leave:</span>
                            <span className="text-[15px] font-bold text-slate-800 dark:text-slate-100">−{requested} days</span>
                          </div>
                          
                          {/* Prominent Projected Balance Row */}
                          <div className="flex justify-between items-center font-extrabold pt-2 border-t border-slate-200/60 dark:border-slate-600 text-base">
                            <span className="text-slate-900 dark:text-white font-extrabold">Projected balance:</span>
                            <span className={`text-base font-black ${
                              isOverdraft ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                            }`}>
                              {projectedBalance !== null ? `${projectedBalance} days` : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Overdraft Policy Warning Box */}
                        {isOverdraft && (
                          <div className={`p-3.5 mt-3 rounded-xl text-xs sm:text-sm font-semibold flex items-start gap-2.5 leading-snug w-full ${
                            isOverdraftProhibited
                              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}>
                            <Info size={16} className="shrink-0 mt-0.5" />
                            <span className="block flex-1">
                              {isOverdraftProhibited
                                ? 'Approval is blocked because the projected balance exceeds the authorised limit.'
                                : 'Overdraft permitted by the applicable policy.'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* ── COL 3: Actions & Team Availability Button (minmax 250px) ── */}
                      <div className="w-full flex flex-col items-stretch lg:items-end gap-3">
                        
                        {/* Primary Approve / Secondary Decline Buttons */}
                        <div className="flex items-center gap-2.5 w-full justify-end">
                          <button
                            type="button"
                            disabled={actionLoading !== null || isOverdraftProhibited}
                            onClick={() => setActiveActionModal({ request: req, type: 'approved' })}
                            className={`flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-extrabold shadow-xs transition-all cursor-pointer active:scale-95 ${
                              isOverdraftProhibited
                                ? 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                            title={isOverdraftProhibited ? 'Approval is blocked because the projected balance exceeds the authorised limit.' : 'Approve request'}
                          >
                            <Check size={16} />
                            <span>Approve</span>
                          </button>

                          <button
                            type="button"
                            disabled={actionLoading !== null}
                            onClick={() => setActiveActionModal({ request: req, type: 'rejected' })}
                            className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <X size={16} />
                            <span>Decline</span>
                          </button>
                        </div>

                        {/* Collapsible Team Availability summary button */}
                        <button
                          type="button"
                          onClick={() => toggleTeamAvailability(req.requestId)}
                          className="w-full flex items-center justify-between lg:justify-end gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#1b2559] dark:hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Users size={14} className="text-slate-400" />
                            <span>
                              {availabilityData[req.requestId] && availabilityData[req.requestId] !== 'error'
                                ? `${(availabilityData[req.requestId] as TeamAvailabilityResult).members.filter(m => m.onLeaveDuringPeriod && !m.isRequester).length} other team members unavailable`
                                : 'Team Availability'}
                            </span>
                          </span>
                          <ChevronDown size={14} className={`transition-transform ${availabilityOpen[req.requestId] ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* ── Collapsible Team Availability Drawer ── */}
                    {availabilityOpen[req.requestId] && (
                      <div className="py-3.5 px-6 border-t border-slate-200/80 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                        {availabilityLoading[req.requestId] ? (
                          <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
                            <RefreshCw size={14} className="animate-spin text-[#1b2559]" />
                            <span>Loading team availability schedule...</span>
                          </div>
                        ) : availabilityData[req.requestId] === 'error' ? (
                          <p className="text-xs text-rose-500 py-2">Could not load team availability data.</p>
                        ) : (() => {
                          const data = availabilityData[req.requestId] as TeamAvailabilityResult | undefined;
                          if (!data) return null;
                          
                          const otherMembers = data.members.filter(m => !m.isRequester);
                          const otherMembersAbsent = otherMembers.filter(m => m.onLeaveDuringPeriod).length;
                          const totalOtherMembers = otherMembers.length;
                          const totalTeamSize = data.teamSize;
                          const projectedUnavailableCount = otherMembersAbsent + 1;

                          return (
                            <div className="space-y-3 text-xs">
                              
                              {/* Precise Wording Impact Banner */}
                              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold space-y-1">
                                <div className="flex items-center gap-2">
                                  <Users size={15} className="text-[#1b2559] dark:text-indigo-400 shrink-0" />
                                  <span>
                                    <strong>{otherMembersAbsent} of {totalOtherMembers} other team members</strong> {otherMembersAbsent === 1 ? 'is' : 'are'} already unavailable during this period.
                                  </span>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs pl-6">
                                  Approving this request would result in <strong>{projectedUnavailableCount} of {totalTeamSize} total team members</strong> being unavailable.
                                </p>
                              </div>

                              {/* Absent Member Pills */}
                              <div className="flex flex-wrap gap-2">
                                {data.members.map(m => (
                                  <span
                                    key={m.employeeId}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${
                                      m.isRequester
                                        ? 'bg-blue-50 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800'
                                        : m.onLeaveDuringPeriod
                                          ? 'bg-pink-50 text-pink-900 border-pink-300 dark:bg-pink-950/60 dark:text-pink-200 dark:border-pink-800'
                                          : 'bg-white text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                                    }`}
                                  >
                                    {m.isRequester ? (
                                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                    ) : m.onLeaveDuringPeriod ? (
                                      <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0" />
                                    ) : (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                                    )}
                                    <span className="font-bold">{m.employeeName}</span>
                                    {m.isRequester && <span className="text-blue-700 dark:text-blue-300 font-semibold">(requester)</span>}
                                    {m.onLeaveDuringPeriod && !m.isRequester && (
                                      <span className="text-slate-600 dark:text-slate-300">
                                        · {m.requests.find(r => r.status !== 'REJECTED')?.leaveTypeName ?? 'Approved absence'}
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>

                              {/* Compact Timeline with Legend directly above matrix */}
                              <div className="space-y-2 pt-1">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-medium">
                                  <span>Schedule Matrix ({new Date(`${data.windowStart}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – {new Date(`${data.windowEnd}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})</span>
                                  
                                  {/* Legend directly above schedule matrix */}
                                  <div className="flex items-center gap-3 text-xs flex-wrap">
                                    <span className="flex items-center gap-1">
                                      <span className="w-3 h-3 rounded-xs border-2 border-blue-600 bg-blue-50 dark:bg-blue-950/40" />
                                      <span>Blue outline: Requested period</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-3 h-3 rounded-xs bg-pink-100 border border-pink-300 dark:bg-pink-950/60" />
                                      <span>Pink: Approved absence</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-3 h-3 rounded-xs bg-amber-100 border border-amber-300 dark:bg-amber-950/60" />
                                      <span>Amber: Reduced availability</span>
                                    </span>
                                  </div>
                                </div>

                                <div className="flex gap-1.5 justify-between overflow-x-auto pb-1 pt-1 px-0.5 scrollbar-thin">
                                  {data.timeline.map(day => {
                                    const inPeriod = day.date >= data.startDate && day.date <= data.endDate;
                                    const count = day.onLeave.length;
                                    
                                    let bg = 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300';
                                    if (count === 1) {
                                      bg = 'bg-pink-100 text-pink-900 border border-pink-300 dark:bg-pink-950/60 dark:text-pink-200';
                                    } else if (count >= 2) {
                                      bg = 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200';
                                    }

                                    return (
                                      <div
                                        key={day.date}
                                        title={day.onLeave.map(o => o.employeeName).join(', ') || 'No absences'}
                                        className={`flex-1 min-w-[50px] px-1.5 py-1.5 rounded-lg flex flex-col items-center gap-0.5 text-center transition-all ${bg} ${
                                          inPeriod ? 'ring-2 ring-blue-600 dark:ring-blue-400 font-bold shadow-xs' : ''
                                        }`}
                                      >
                                        <span className="text-[10px] font-medium whitespace-nowrap">
                                          {new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        </span>
                                        <span className="text-xs font-black">
                                          {count === 0 ? '0' : `${count}`}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── DIRECTS BALANCE TAB ── */
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden p-6 space-y-4">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search direct reports..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1b2559]"
            />
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  {leaveTypes.map(t => (
                    <th key={t.id} className="py-3 px-4 text-center whitespace-nowrap">{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredDirects.length === 0 ? (
                  <tr>
                    <td colSpan={leaveTypes.length + 1} className="py-12 text-center text-slate-400 text-sm">
                      No direct reports found.
                    </td>
                  </tr>
                ) : (
                  filteredDirects.map(rep => (
                    <tr key={rep.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={rep.fullName} size="sm" />
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{rep.fullName}</p>
                            <p className="text-xs text-slate-400">{rep.department || 'Employee'}</p>
                          </div>
                        </div>
                      </td>
                      {leaveTypes.map(type => {
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
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                                isNegative
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                  : isLow
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                              }`}>
                                {amount} days
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Standalone Team Availability Overview Drawer ── */}
      {overviewModalOpen && (
        <div
          className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setOverviewModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-y-0 right-0 h-full w-full max-w-6xl bg-white dark:bg-slate-800 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-700 overflow-hidden"
          >

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1b2559] text-white flex items-center justify-center shadow-xs">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-tight">
                    Team Availability & Absence Schedule
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Full team schedule matrix across custom date windows
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOverviewModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Presets & Controls Toolbar */}
            <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px] mr-1">Presets:</span>
                <button
                  type="button"
                  onClick={() => setPresetRange(7)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                    activePreset === '7'
                      ? 'bg-[#1b2559] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-[#1b2559] hover:text-white'
                  }`}
                >
                  7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setPresetRange(14)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                    activePreset === '14'
                      ? 'bg-[#1b2559] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-[#1b2559] hover:text-white'
                  }`}
                >
                  14 Days
                </button>
                <button
                  type="button"
                  onClick={() => setPresetRange(30)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                    activePreset === '30'
                      ? 'bg-[#1b2559] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-[#1b2559] hover:text-white'
                  }`}
                >
                  30 Days
                </button>
                <button
                  type="button"
                  onClick={setThisMonthPreset}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                    activePreset === 'month'
                      ? 'bg-[#1b2559] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-[#1b2559] hover:text-white'
                  }`}
                >
                  This Month
                </button>
                {activePreset === 'custom' && (
                  <span className="px-2.5 py-1 rounded-lg font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 text-[11px]">
                    Custom Range
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="font-bold text-slate-400">From:</label>
                  <input
                    type="date"
                    value={overviewDateFrom}
                    onChange={(e) => {
                      setOverviewDateFrom(e.target.value);
                      setActivePreset('custom');
                    }}
                    className="px-2.5 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg font-semibold text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="font-bold text-slate-400">To:</label>
                  <input
                    type="date"
                    value={overviewDateTo}
                    onChange={(e) => {
                      setOverviewDateTo(e.target.value);
                      setActivePreset('custom');
                    }}
                    className="px-2.5 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg font-semibold text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Modal Body: Adapt height to number of members */}
            <div className="p-4 overflow-hidden flex-1 flex flex-col gap-3 bg-slate-50/40 dark:bg-slate-900/30">
              {overviewLoading ? (
                <div className="py-16 flex items-center justify-center gap-3 text-[#1b2559] dark:text-indigo-300 font-bold text-sm">
                  <RefreshCw size={20} className="animate-spin" /> Loading schedule matrix...
                </div>
              ) : overviewData ? (() => {
                // Clamp timeline client-side to exact selected range (safety net against backend padding)
                const clampedTimeline = overviewData.timeline.filter(
                  d => d.date >= overviewDateFrom && d.date <= overviewDateTo
                );

                // Calculate maximum simultaneous daily absence
                let maxSimultaneous = 0;
                let peakDates: string[] = [];

                clampedTimeline.forEach(day => {
                  const count = day.onLeave.length;
                  if (count > maxSimultaneous) {
                    maxSimultaneous = count;
                    peakDates = [day.date];
                  } else if (count === maxSimultaneous && count > 0) {
                    peakDates.push(day.date);
                  }
                });

                const formattedPeakDates = peakDates.slice(0, 2).map(d => 
                  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                ).join(', ') + (peakDates.length > 2 ? ` (+${peakDates.length - 2} more dates)` : '');

                const availableWorkforce = overviewData.teamSize - maxSimultaneous;
                const isCriticalAbsence = availableWorkforce === 0 && overviewData.teamSize > 0;

                return (
                  <>
                    {/* Mathematically Accurate Simultaneous Absence Banner */}
                    <div className={`px-4 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
                      isCriticalAbsence
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                        : maxSimultaneous > 0
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <AlertTriangle size={15} className="shrink-0" />
                        <span>
                          {maxSimultaneous > 0 ? (
                            <>
                              <strong>Maximum simultaneous absence: {maxSimultaneous} of {overviewData.teamSize} team members.</strong>
                              {isCriticalAbsence ? (
                                <> No team members remain available on {peakDates.length} {peakDates.length === 1 ? 'date' : 'dates'} ({formattedPeakDates}).</>
                              ) : (
                                <> {availableWorkforce} team members remain available on peak dates ({formattedPeakDates}).</>
                              )}
                            </>
                          ) : (
                            <>
                              <strong>Full team availability:</strong> 0 members absent during this selected period. ({overviewData.teamSize} members available)
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Legend & Navigation Controls Directly Above Matrix */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium px-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Team Schedule Matrix</span>
                        
                        {/* Horizontal Scroll Buttons */}
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg border border-slate-200 dark:border-slate-600">
                          <button
                            type="button"
                            title="Scroll schedule left"
                            onClick={() => matrixScrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' })}
                            className="p-1 rounded hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            type="button"
                            title="Scroll schedule right"
                            onClick={() => matrixScrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
                            className="p-1 rounded hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Accessible Status Legend */}
                      <div className="flex items-center gap-3.5 text-xs flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded-xs text-emerald-600 bg-emerald-50 border border-emerald-200 flex items-center justify-center font-bold text-[10px]">✓</span>
                          <span>Available</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded-xs bg-pink-100 border border-pink-300 dark:bg-pink-950/60" />
                          <span>Approved Leave</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded-xs bg-amber-100 border border-amber-300 dark:bg-amber-950/60" />
                          <span>Pending Leave</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded-xs bg-rose-500 text-white flex items-center justify-center text-[9px] font-black">!</span>
                          <span>Critical Absence</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded-xs bg-slate-200/70 border border-slate-300 dark:bg-slate-700" />
                          <span>Weekend</span>
                        </span>
                      </div>
                    </div>

                    {/* Schedule Matrix Container */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-slate-800 flex flex-col">
                      <div
                        ref={matrixScrollRef}
                        className="overflow-auto max-w-full max-h-[60vh] scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600"
                      >
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-700/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider sticky top-0 z-30">
                              
                              {/* Sticky Member Column Header (min-w 220px) */}
                              <th className="py-2.5 px-4 sticky left-0 z-40 bg-slate-100 dark:bg-slate-700 min-w-[220px] max-w-[240px] border-r border-slate-200 dark:border-slate-600">
                                Team Member
                              </th>

                              {/* Date Header Cells */}
                              {clampedTimeline.map((day) => {
                                const dObj = new Date(`${day.date}T00:00:00Z`);
                                const dayName = dObj.toLocaleDateString('en-GB', { weekday: 'short' });
                                const dayNum = dObj.getUTCDate();
                                const monthName = dObj.toLocaleDateString('en-GB', { month: 'short' });
                                const isWeekend = dObj.getUTCDay() === 0 || dObj.getUTCDay() === 6;
                                const isToday = day.date === todayStr;
                                const count = day.onLeave.length;

                                return (
                                  <th
                                    key={day.date}
                                    className={`py-2 px-3 text-center min-w-[115px] border-r border-slate-200/60 dark:border-slate-700/60 ${
                                      isToday ? 'bg-blue-50/80 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500' : isWeekend ? 'bg-slate-200/50 dark:bg-slate-800/80 text-slate-400' : ''
                                    }`}
                                  >
                                    <div className="text-[10px] text-slate-400 font-semibold">{dayName}</div>
                                    <div className="text-xs font-black text-slate-800 dark:text-slate-100">{dayNum} {monthName}</div>
                                    
                                    {/* Absence Badges */}
                                    <div className="mt-0.5">
                                      {count === 0 ? (
                                        <span className="text-[9px] font-semibold text-slate-400">0 absent</span>
                                      ) : count === 1 ? (
                                        <span
                                          title={day.onLeave.map(o => `${o.employeeName} (${o.leaveTypeName})`).join(', ')}
                                          className="inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200"
                                        >
                                          1 absent
                                        </span>
                                      ) : (
                                        <span
                                          title={day.onLeave.map(o => `${o.employeeName} (${o.leaveTypeName})`).join(', ')}
                                          className="inline-block text-[9px] px-2 py-0.5 rounded-full font-extrabold bg-rose-500 text-white shadow-xs"
                                        >
                                          {count} absent
                                        </span>
                                      )}
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            {overviewData.members.map((member) => (
                              <tr key={member.employeeId} className="h-14 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                                
                                {/* Sticky Member Info Cell */}
                                <td className="py-2.5 px-4 sticky left-0 z-20 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-xs">
                                  <div className="flex items-center gap-3">
                                    <Avatar name={member.employeeName} size="sm" />
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate max-w-[150px]">
                                        {member.employeeName}
                                      </p>
                                      <p className="text-xs text-slate-400 truncate max-w-[150px]">
                                        {member.department || 'Employee'}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                {/* Date Cells: Render Continuous Leave Bars */}
                                {clampedTimeline.map((day, idx) => {
                                  const dObj = new Date(`${day.date}T00:00:00Z`);
                                  const isWeekend = dObj.getUTCDay() === 0 || dObj.getUTCDay() === 6;

                                  const req = member.requests.find(
                                    (r) => r.status !== 'REJECTED' && day.date >= r.startDate.slice(0, 10) && day.date <= r.endDate.slice(0, 10)
                                  );

                                  // Check previous & next days to form continuous bars
                                  const prevDateStr = idx > 0 ? clampedTimeline[idx - 1].date : null;
                                  const nextDateStr = idx < clampedTimeline.length - 1 ? clampedTimeline[idx + 1].date : null;

                                  const isPrevSameReq = req && prevDateStr && member.requests.some(r => r.requestId === req.requestId && prevDateStr >= r.startDate.slice(0, 10) && prevDateStr <= r.endDate.slice(0, 10));
                                  const isNextSameReq = req && nextDateStr && member.requests.some(r => r.requestId === req.requestId && nextDateStr >= r.startDate.slice(0, 10) && nextDateStr <= r.endDate.slice(0, 10));

                                  const isStartCell = req && (!isPrevSameReq || day.date === req.startDate.slice(0, 10));
                                  const isEndCell = req && (!isNextSameReq || day.date === req.endDate.slice(0, 10));

                                  return (
                                    <td
                                      key={day.date}
                                      className={`py-2 px-0 text-center border-r border-slate-100 dark:border-slate-700/40 align-middle ${
                                        isWeekend ? 'bg-slate-50/70 dark:bg-slate-900/40' : ''
                                      }`}
                                    >
                                      {req ? (
                                        <div
                                          title={`${member.employeeName} · ${req.leaveTypeName} (${req.status || 'APPROVED'})\nDates: ${req.startDate.slice(0,10)} to ${req.endDate.slice(0,10)}`}
                                          className={`py-1.5 text-xs font-bold whitespace-nowrap shadow-xs border transition-all h-8 flex items-center justify-center ${
                                            isStartCell && isEndCell
                                              ? 'rounded-lg mx-1 px-2 border-l border-r border-t border-b'
                                              : isStartCell
                                                ? 'rounded-l-lg ml-1 border-l border-t border-b border-r-0'
                                                : isEndCell
                                                  ? 'rounded-r-lg mr-1 border-r border-t border-b border-l-0'
                                                  : 'rounded-none border-t border-b border-l-0 border-r-0'
                                          } ${
                                            req.status === 'PENDING'
                                              ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200'
                                              : 'bg-pink-100 text-pink-900 border-pink-300 dark:bg-pink-950/60 dark:text-pink-200'
                                          }`}
                                        >
                                          {isStartCell ? req.leaveTypeName : ''}
                                        </div>
                                      ) : (
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-bold" title="Available">
                                          ✓
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
                  </>
                );
              })() : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
