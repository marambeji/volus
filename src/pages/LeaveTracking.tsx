import { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import ApprovalProgressTimeline from '../components/ui/ApprovalProgressTimeline';
import SlideDrawer from '../admin/components/ui/SlideDrawer';
import SearchInput from '../admin/components/ui/SearchInput';

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

export default function LeaveTracking() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<RequestItem | null>(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  async function loadRequests() {
    try {
      setLoading(true);
      const data = await apiFetch<any[]>('/leave-requests/my-requests');
      if (Array.isArray(data)) {
        const mapped = data.map((r: any) => ({
          id: r.id,
          leaveTypeId: r.leaveTypeId,
          leaveTypeName: r.leaveType?.label || r.leaveType?.key || 'Leave Request',
          startDate: r.startDate,
          endDate: r.endDate,
          durationDays: r.durationDays,
          reason: r.reason,
          status: r.status ? r.status.toUpperCase() : 'PENDING',
          createdAt: r.createdAt,
          rejectionReason: r.rejectionReason,
          currentStepOrder: r.currentStepOrder,
          totalRequiredSteps: r.totalRequiredSteps || (r.approvalInstances?.length ?? 0),
          currentApproverType: r.currentApproverType,
          currentApproverLabel: r.currentApproverLabel,
          approvalInstances: (r.approvalInstances || []).sort((a: any, b: any) => a.stepOrder - b.stepOrder),
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

  const filteredRequests = requests
    .filter((r) => (r.leaveTypeName || '').toLowerCase().includes(search.toLowerCase()))
    .filter((r) => !dateFrom || r.endDate >= dateFrom)
    .filter((r) => !dateTo || r.startDate <= dateTo)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      {/* Search & Date Range Filter Bar */}
      {requests.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-slate-100 dark:border-slate-700/80 shadow-sm flex flex-wrap gap-3">
          <div className="flex-1 min-w-48">
            <SearchInput value={search} onChange={setSearch} placeholder="Search leave type (e.g. Annual Leave)..." />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2.5 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2.5 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
            />
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && requests.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 border border-slate-100 dark:border-slate-700/80 shadow-sm flex items-center justify-center min-h-[220px]">
          <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
            <RefreshCw size={20} className="animate-spin text-violet-600" />
            <span>Loading approval progress data...</span>
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 border border-slate-100 dark:border-slate-700/80 shadow-sm text-center">
          <CheckCircle2 className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={48} />
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">No Submitted Requests</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            You currently have no submitted leave requests yet.
          </p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 border border-slate-100 dark:border-slate-700/80 shadow-sm text-center">
          <CheckCircle2 className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={48} />
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">No Matching Requests</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            No leave requests match "{search}". Try a different search term.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredRequests.map((req) => {
            const isPending = req.status === 'PENDING';
            const isApproved = req.status === 'APPROVED';
            const isRejected = req.status === 'REJECTED';

            return (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/80 shadow-sm hover:border-violet-300 dark:hover:border-violet-600 transition-all space-y-6"
              >
                {/* Header Summary Row */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700/80">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300 flex items-center justify-center font-black text-base shadow-xs">
                      {req.durationDays}d
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {req.leaveTypeName}
                      </h2>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Calendar size={14} className="text-slate-400" />
                          {new Date(req.startDate).toLocaleDateString('en-GB')} → {new Date(req.endDate).toLocaleDateString('en-GB')}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="text-slate-400">
                          Submitted: {new Date(req.createdAt).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full ${
                        isApproved
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : isRejected
                          ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                          : 'bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300'
                      }`}
                    >
                      {req.status}
                    </span>
                    <button
                      onClick={() => setSelectedReq(req)}
                      className="px-3.5 py-1.5 text-xs font-extrabold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/60 rounded-full transition-colors flex items-center gap-1"
                    >
                      Full Details <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Current Active Level Banner */}
                {isPending && req.currentStepOrder && req.totalRequiredSteps ? (
                  <div className="bg-violet-50/90 dark:bg-violet-950/50 p-4 rounded-2xl border border-violet-100 dark:border-violet-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-violet-600 dark:text-violet-400 animate-pulse" />
                      <span className="font-extrabold text-violet-900 dark:text-violet-200">
                        Current Stage: Level {req.currentStepOrder} of {req.totalRequiredSteps}
                      </span>
                    </div>
                    <span className="font-bold text-violet-700 dark:text-violet-300 italic">
                      Under review by {req.currentApproverLabel || 'Approver'}
                    </span>
                  </div>
                ) : null}

                {/* Approval Progression Stepper */}
                <div className="bg-slate-50/60 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">
                    Sequential Multi-Level Progression
                  </h3>
                  <ApprovalProgressTimeline
                    submittedAt={req.createdAt}
                    steps={req.approvalInstances || []}
                    requestStatus={req.status}
                    rejectionReason={req.rejectionReason}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Leave Request Details SlideDrawer */}
      <SlideDrawer
        isOpen={!!selectedReq}
        onClose={() => setSelectedReq(null)}
        title="Leave Request Details & Approval Progress"
        subtitle={selectedReq ? `${selectedReq.leaveTypeName} (${selectedReq.durationDays} ${selectedReq.durationDays === 1 ? 'day' : 'days'})` : ''}
      >
        {selectedReq && (
          <div className="p-6 flex flex-col gap-6">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/80 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Leave Type</span>
                <span className="text-xs font-extrabold text-slate-800 dark:text-white">{selectedReq.leaveTypeName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dates</span>
                <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                  {new Date(selectedReq.startDate).toLocaleDateString('en-GB')} → {new Date(selectedReq.endDate).toLocaleDateString('en-GB')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Status</span>
                <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  {selectedReq.status}
                </span>
              </div>
              {selectedReq.reason && (
                <div className="mt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Reason / Note</span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                    "{selectedReq.reason}"
                  </p>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                Approval Instances Timeline
              </h3>
              <ApprovalProgressTimeline
                submittedAt={selectedReq.createdAt}
                steps={selectedReq.approvalInstances || []}
                requestStatus={selectedReq.status}
                rejectionReason={selectedReq.rejectionReason}
              />
            </div>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
