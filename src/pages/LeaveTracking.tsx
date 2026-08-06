import { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  XCircle,
  Clock,
  Filter,
} from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import ApprovalProgressTimeline from '../components/ui/ApprovalProgressTimeline';
import SlideDrawer from '../admin/components/ui/SlideDrawer';
import Pagination from '../components/ui/Pagination';

interface RequestItem {
  id: string;
  leaveTypeId: string;
  leaveTypeName?: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  reason?: string;
  status: string;
  createdAt: string;
  rejectionReason?: string | null;
  currentStepOrder?: number | null;
  totalRequiredSteps?: number;
  currentApproverType?: string | null;
  currentApproverLabel?: string | null;
  approvalInstances?: any[];
}


function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function LeaveTracking() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<RequestItem | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => { setCurrentPage(1); }, [filterType, dateFrom, dateTo]);

  async function loadRequests() {
    try {
      setLoading(true);
      const data = await apiFetch<any[]>('/leave-requests/my-requests');
      if (Array.isArray(data)) {
        const mapped = data.map((r: any) => ({
          id: r.id || String(Math.random()),
          leaveTypeId: r.leaveTypeId || '',
          leaveTypeName: r.leaveType?.label || r.leaveType?.key || r.leaveTypeName || 'Leave Request',
          startDate: r.startDate || '',
          endDate: r.endDate || '',
          durationDays: r.durationDays ?? 1,
          reason: r.reason || '',
          status: r.status ? String(r.status).toUpperCase() : 'PENDING',
          createdAt: r.createdAt || new Date().toISOString(),
          rejectionReason: r.rejectionReason || null,
          currentStepOrder: r.currentStepOrder || null,
          totalRequiredSteps: r.totalRequiredSteps || (r.approvalInstances?.length ?? 0),
          currentApproverType: r.currentApproverType || null,
          currentApproverLabel: r.currentApproverLabel || null,
          approvalInstances: Array.isArray(r.approvalInstances)
            ? [...r.approvalInstances].sort((a: any, b: any) => (a.stepOrder || 0) - (b.stepOrder || 0))
            : [],
        }));
        setRequests(mapped);
      }
    } catch (err) {
      console.error('Failed to load employee leave requests:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
    const handleRefresh = () => { void loadRequests(); };
    window.addEventListener('leave-request-submitted', handleRefresh);
    return () => { window.removeEventListener('leave-request-submitted', handleRefresh); };
  }, []);

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      await apiFetch(`/leave-requests/${id}/cancel`, { method: 'PATCH' });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'CANCELLED' } : r));
      if (selectedReq?.id === id) setSelectedReq(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
      setConfirmCancelId(null);
    } catch (err: any) {
      console.error('Failed to cancel request:', err);
      alert(err?.message || 'Could not cancel this request. Please try again.');
    } finally {
      setCancellingId(null);
    }
  }

  // Combined leave types list for dropdown filter
  const systemLeaveTypes = [
    'Annual Leave',
    'Public Holiday',
    'Compensation Leave',
    'Overtime Leave',
    'Sick Leave',
    'Maternity Leave',
    'Paternity Leave',
    'Bereavement Leave',
    'Unpaid Leave',
    'Other Leave',
    'Seq Leave',
  ];
  const requestLeaveTypes = requests.map(r => r.leaveTypeName).filter(Boolean) as string[];
  const leaveTypes = Array.from(new Set([...systemLeaveTypes, ...requestLeaveTypes]));

  const filteredRequests = requests
    .filter(r => !filterType || r.leaveTypeName === filterType)
    .filter(r => {
      if (!dateFrom) return true;
      const s = (r.startDate || '').slice(0, 10);
      const e = (r.endDate || '').slice(0, 10);
      return (s && s >= dateFrom) || (e && e >= dateFrom);
    })
    .filter(r => {
      if (!dateTo) return true;
      const s = (r.startDate || '').slice(0, 10);
      return s && s <= dateTo;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Summary counters
  const counts = {
    total: filteredRequests.length,
    approved: filteredRequests.filter(r => r.status === 'APPROVED').length,
    pending: filteredRequests.filter(r => r.status === 'PENDING').length,
    rejected: filteredRequests.filter(r => r.status === 'REJECTED').length,
    cancelled: filteredRequests.filter(r => r.status === 'CANCELLED').length,
  };

  // Pagination
  const paginated = filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasFilters = filterType || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      {/* LEAVE PORTAL Tag */}
      <div className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black tracking-wider uppercase px-3 py-1 rounded-lg">
        LEAVE PORTAL
      </div>

      {/* ── Filter Bar matching User Screenshot ─────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-100 dark:border-slate-700 shadow-xs flex flex-wrap items-center gap-3">
        {/* Dropdown Select List */}
        <div className="flex-1 min-w-[220px] relative">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer appearance-none"
          >
            <option value="">All Leave Types</option>
            {leaveTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <Filter size={14} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
        </div>

        {/* FROM Date */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase">FROM</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
          />
        </div>

        {/* TO Date */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase">TO</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => { setFilterType(''); setDateFrom(''); setDateTo(''); }}
            className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Reset Filters"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* ── Sub-header / Counter Bar matching User Screenshot ──────────────── */}
      {!loading && requests.length > 0 && (
        <div className="flex flex-wrap items-center justify-between px-1 text-xs text-slate-400">
          <span>{counts.total} requests total</span>
          <div className="flex items-center gap-4 font-semibold text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              {counts.approved} approved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              {counts.pending} pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              {counts.rejected} rejected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
              {counts.cancelled} cancelled
            </span>
          </div>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && requests.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 border border-slate-100 dark:border-slate-700 shadow-xs flex items-center justify-center min-h-[200px]">
          <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
            <RefreshCw size={18} className="animate-spin text-purple-600" />
            <span>Loading your leave requests…</span>
          </div>
        </div>
      )}

      {/* ── Empty states ─────────────────────────────────────────────────── */}
      {!loading && requests.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-14 border border-slate-100 dark:border-slate-700 shadow-xs text-center">
          <CheckCircle2 className="mx-auto text-slate-200 dark:text-slate-600 mb-3" size={48} />
          <h3 className="text-base font-extrabold text-slate-700 dark:text-slate-200">No Leave Requests Yet</h3>
          <p className="text-xs text-slate-400 mt-1">Submit your first leave request to track its approval status here.</p>
        </div>
      )}
      {!loading && requests.length > 0 && filteredRequests.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-14 border border-slate-100 dark:border-slate-700 shadow-xs text-center">
          <CheckCircle2 className="mx-auto text-slate-200 dark:text-slate-600 mb-3" size={48} />
          <h3 className="text-base font-extrabold text-slate-700 dark:text-slate-200">No Matching Requests</h3>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search or date filters.</p>
        </div>
      )}

      {/* ── Request List Cards matching User Screenshot ───────────────────── */}
      {!loading && filteredRequests.length > 0 && (
        <div className="space-y-3">
          {paginated.map(req => {
            const isApproved = req.status === 'APPROVED';
            const isRejected = req.status === 'REJECTED';
            const isPending = req.status === 'PENDING';
            const isCancelled = req.status === 'CANCELLED';

            const dotColor = isApproved
              ? 'bg-emerald-500'
              : isRejected
              ? 'bg-red-500'
              : isPending
              ? 'bg-amber-400'
              : 'bg-purple-400';

            const levelText = req.currentStepOrder && req.totalRequiredSteps
              ? `Level ${req.currentStepOrder}/${req.totalRequiredSteps}`
              : 'Level 1/1';

            return (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/80 shadow-xs flex items-center justify-between gap-4 hover:border-purple-200 dark:hover:border-purple-900 transition-all"
              >
                {/* Left Section: Dot, Duration Badge, Title & Dates */}
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Status dot */}
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />

                  {/* Circular Purple Duration Badge */}
                  <div className="w-12 h-12 rounded-full flex flex-col items-center justify-center bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 flex-shrink-0">
                    <span className="text-sm font-black leading-none">{req.durationDays}</span>
                    <span className="text-[7.5px] font-extrabold uppercase tracking-tight leading-none mt-0.5">
                      {req.durationDays === 1 ? 'DAY' : 'DAYS'}
                    </span>
                  </div>

                  {/* Title & Dates */}
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                      {req.leaveTypeName}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <Calendar size={12} className="text-slate-400 flex-shrink-0" />
                      <span>
                        {formatDate(req.startDate)}
                        {' → '}
                        {formatDate(req.endDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Section: Submitted Date, Badges, Cancel Button, Details Button */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Submitted Date Stacked */}
                  <div className="text-right hidden sm:block mr-1">
                    <span className="text-[10px] text-slate-400 block leading-tight">Submitted</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                      {formatDate(req.createdAt)}
                    </span>
                  </div>

                  {/* Level 1/1 Badge for Pending */}
                  {isPending && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                      <Clock size={11} className="text-amber-500" />
                      {levelText}
                    </span>
                  )}

                  {/* Status Badge */}
                  {isApproved && (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full text-xs font-bold">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      Approved
                    </span>
                  )}

                  {isPending && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-full text-xs font-bold">
                      <Clock size={12} className="text-amber-500" />
                      Pending
                    </span>
                  )}

                  {isRejected && (
                    <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-3 py-1 rounded-full text-xs font-bold">
                      <XCircle size={12} className="text-red-500" />
                      Rejected
                    </span>
                  )}

                  {isCancelled && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 px-3 py-1 rounded-full text-xs font-bold">
                      <XCircle size={12} className="text-slate-400" />
                      Cancelled
                    </span>
                  )}

                  {/* Inline Cancel Button for Pending items */}
                  {isPending && (
                    <button
                      onClick={() => {
                        setSelectedReq(req);
                        setConfirmCancelId(req.id);
                      }}
                      className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer"
                    >
                      <XCircle size={12} />
                      Cancel
                    </button>
                  )}

                  {/* Details > Button */}
                  <button
                    onClick={() => setSelectedReq(req)}
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors flex items-center gap-0.5 cursor-pointer ml-1"
                  >
                    Details <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          <Pagination
            currentPage={currentPage}
            totalItems={filteredRequests.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      )}

      {/* ── Leave Request Details Slide Drawer matching User Screenshot ───────── */}
      <SlideDrawer
        isOpen={!!selectedReq}
        onClose={() => { setSelectedReq(null); setConfirmCancelId(null); }}
        title="Leave Request Details"
        subtitle={selectedReq ? `${selectedReq.leaveTypeName} · ${selectedReq.durationDays} ${selectedReq.durationDays === 1 ? 'day' : 'days'}` : ''}
      >
        {selectedReq && (
          <div className="flex flex-col h-full gap-6">
            {/* Details Card matching Screenshot */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 flex flex-col gap-3.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Leave Type</span>
                <span className="font-extrabold text-slate-800 dark:text-white">{selectedReq.leaveTypeName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">From</span>
                <span className="font-extrabold text-slate-800 dark:text-white">
                  {formatDate(selectedReq.startDate)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">To</span>
                <span className="font-extrabold text-slate-800 dark:text-white">
                  {formatDate(selectedReq.endDate)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Duration</span>
                <span className="font-extrabold text-slate-800 dark:text-white">
                  {selectedReq.durationDays} {selectedReq.durationDays === 1 ? 'day' : 'days'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Submitted</span>
                <span className="font-extrabold text-slate-800 dark:text-white">
                  {formatDate(selectedReq.createdAt)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Status</span>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  selectedReq.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' : selectedReq.status === 'REJECTED' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {selectedReq.status}
                </span>
              </div>
              {selectedReq.reason && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700 mt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Reason / Note</span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                    "{selectedReq.reason}"
                  </p>
                </div>
              )}
            </div>

            {/* Approval Timeline matching Screenshot */}
            <div>
              <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                APPROVAL TIMELINE
              </h3>
              <ApprovalProgressTimeline
                submittedAt={selectedReq.createdAt}
                steps={selectedReq.approvalInstances || []}
                requestStatus={selectedReq.status}
                rejectionReason={selectedReq.rejectionReason}
              />
            </div>

            {/* Cancel Request Section with Confirmation Box matching Screenshot */}
            {selectedReq.status === 'PENDING' && (
              <div className="mt-auto pt-4">
                {confirmCancelId === selectedReq.id ? (
                  <div className="bg-red-50/90 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex flex-col gap-3.5 text-center">
                    <p className="text-xs font-bold text-red-700 dark:text-red-300">
                      Are you sure you want to cancel this leave request?
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setConfirmCancelId(null)}
                        className="flex-1 py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                      >
                        Keep Request
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancel(selectedReq.id)}
                        disabled={cancellingId === selectedReq.id}
                        className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {cancellingId === selectedReq.id ? 'Cancelling…' : 'Yes, Cancel'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmCancelId(selectedReq.id)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-2xl transition-colors cursor-pointer"
                  >
                    <XCircle size={18} />
                    Cancel Request
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
