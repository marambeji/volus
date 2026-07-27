import { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import ApprovalProgressTimeline from '../ui/ApprovalProgressTimeline';
import SlideDrawer from '../../admin/components/ui/SlideDrawer';

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

export default function ApprovalProgressSection() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<RequestItem | null>(null);

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

  if (loading && requests.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/80 shadow-sm flex items-center justify-center min-h-[160px]">
        <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
          <RefreshCw size={18} className="animate-spin text-violet-600" />
          <span>Loading approval progress...</span>
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <Clock className="text-violet-600 dark:text-violet-400" size={20} />
            My Leave Requests & Approval Progress
          </h2>
        </div>
        <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <CheckCircle2 className="mx-auto text-slate-300 dark:text-slate-600 mb-2" size={36} />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No submitted leave requests found</p>
          <p className="text-xs text-slate-400 mt-1">Submit a leave request to track its multi-level approval progress in real time.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <Clock className="text-violet-600 dark:text-violet-400" size={20} />
              My Leave Requests & Approval Progress
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time sequential approval tracking powered by PostgreSQL instances
            </p>
          </div>
          <button
            onClick={() => void loadRequests()}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Refresh progress"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="space-y-6">
          {requests.map((req) => {
            const isPending = req.status === 'PENDING';
            const isApproved = req.status === 'APPROVED';
            const isRejected = req.status === 'REJECTED';

            return (
              <div
                key={req.id}
                className="bg-slate-50/70 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-violet-300 dark:hover:border-violet-600 transition-all shadow-xs"
              >
                {/* Header Info */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300 flex items-center justify-center font-black text-sm">
                      {req.durationDays}d
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {req.leaveTypeName}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <Calendar size={13} className="text-slate-400" />
                        <span>
                          {new Date(req.startDate).toLocaleDateString('en-GB')} → {new Date(req.endDate).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-extrabold uppercase px-3 py-1 rounded-full ${
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
                      className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 flex items-center gap-1 hover:underline"
                    >
                      Details <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Current Active Level Summary Badge if PENDING */}
                {isPending && req.currentStepOrder && req.totalRequiredSteps ? (
                  <div className="mb-4 bg-violet-50/80 dark:bg-violet-950/40 p-3 rounded-xl border border-violet-100 dark:border-violet-900/50 flex items-center justify-between text-xs">
                    <span className="font-bold text-violet-800 dark:text-violet-300">
                      Current Review Level: Step {req.currentStepOrder} of {req.totalRequiredSteps}
                    </span>
                    <span className="font-medium text-violet-600 dark:text-violet-400 italic">
                      Awaiting approval from {req.currentApproverLabel || 'Approver'}
                    </span>
                  </div>
                ) : null}

                {/* Approval Progression Timeline */}
                <div className="pt-2">
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
      </div>

      {/* Leave Request Details SlideDrawer */}
      <SlideDrawer
        isOpen={!!selectedReq}
        onClose={() => setSelectedReq(null)}
        title="Leave Request Details & Approval Timeline"
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
                Full Approval Timeline
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
    </>
  );
}
