import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Calendar, ArrowRight, CheckCircle2, XCircle, Hourglass } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import ApprovalProgressTimeline from '../ui/ApprovalProgressTimeline';

interface LatestRequest {
  id: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  status: string;
  createdAt: string;
  rejectionReason?: string | null;
  currentStepOrder?: number | null;
  totalRequiredSteps?: number;
  currentApproverLabel?: string | null;
  approvalInstances?: any[];
}

export default function LatestRequestCard() {
  const [request, setRequest] = useState<LatestRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    try {
      setLoading(true);
      const data = await apiFetch<any[]>('/leave-requests/my-requests');
      if (Array.isArray(data) && data.length > 0) {
        // Sort by createdAt descending, take the most recent
        const sorted = [...data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const r = sorted[0];
        setRequest({
          id: r.id,
          leaveTypeName: r.leaveType?.label || r.leaveType?.key || 'Leave Request',
          startDate: r.startDate,
          endDate: r.endDate,
          durationDays: r.durationDays,
          status: (r.status || 'pending').toUpperCase(),
          createdAt: r.createdAt,
          rejectionReason: r.rejectionReason,
          currentStepOrder: r.currentStepOrder,
          totalRequiredSteps: r.totalRequiredSteps || (r.approvalInstances?.length ?? 0),
          currentApproverLabel: r.currentApproverLabel,
          approvalInstances: (r.approvalInstances || []).sort(
            (a: any, b: any) => a.stepOrder - b.stepOrder
          ),
        });
      } else {
        setRequest(null);
      }
    } catch {
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const handler = () => { void load(); };
    window.addEventListener('leave-request-submitted', handler);
    return () => window.removeEventListener('leave-request-submitted', handler);
  }, []);

  const statusIcon =
    request?.status === 'APPROVED' ? (
      <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
    ) : request?.status === 'REJECTED' ? (
      <XCircle size={15} className="text-red-500" />
    ) : (
      <Hourglass size={15} className="text-violet-500 animate-pulse" />
    );

  const statusColor =
    request?.status === 'APPROVED'
      ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/40'
      : request?.status === 'REJECTED'
      ? 'text-red-700 bg-red-50 dark:bg-red-950/60 dark:text-red-300 border-red-100 dark:border-red-900/40'
      : 'text-violet-700 bg-violet-50 dark:bg-violet-950/60 dark:text-violet-300 border-violet-100 dark:border-violet-900/40';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/80 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-violet-500" />
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-white tracking-tight">
            Latest Leave Request
          </h2>
        </div>
        <button
          onClick={() => navigate('/employee/leave-tracking')}
          className="flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 transition-colors"
        >
          All requests <ArrowRight size={12} />
        </button>
      </div>

      {loading ? (
        <div className="px-5 pb-5 flex items-center gap-2 text-xs text-slate-400">
          <Hourglass size={14} className="animate-pulse text-violet-400" />
          Loading…
        </div>
      ) : !request ? (
        <div className="px-5 pb-5 text-xs text-slate-400 italic">
          No leave requests yet. Click "+ Request Time Off" to submit one.
        </div>
      ) : (
        <div className="px-5 pb-5 space-y-4">
          {/* Summary row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300 flex items-center justify-center font-black text-sm">
                {request.durationDays}d
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {request.leaveTypeName}
                </p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Calendar size={11} />
                  {new Date(request.startDate).toLocaleDateString('en-GB')}
                  {request.startDate !== request.endDate && (
                    <> → {new Date(request.endDate).toLocaleDateString('en-GB')}</>
                  )}
                </p>
              </div>
            </div>
            <span className={`flex items-center gap-1.5 text-[11px] font-black uppercase px-2.5 py-1 rounded-full border ${statusColor}`}>
              {statusIcon}
              {request.status}
            </span>
          </div>

          {/* Active Level Banner */}
          {request.status === 'PENDING' && request.currentStepOrder && request.totalRequiredSteps ? (
            <div className="flex items-center gap-2 text-[11px] font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 border border-violet-100 dark:border-violet-900/40 px-3 py-2 rounded-xl">
              <Clock size={13} className="animate-pulse flex-shrink-0" />
              Level {request.currentStepOrder} of {request.totalRequiredSteps} — Awaiting{' '}
              <span className="font-extrabold">{request.currentApproverLabel || 'Approver'}</span>
            </div>
          ) : null}

          {/* Timeline */}
          <div className="bg-slate-50/70 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-700/60 p-4">
            <ApprovalProgressTimeline
              submittedAt={request.createdAt}
              steps={request.approvalInstances || []}
              requestStatus={request.status}
              rejectionReason={request.rejectionReason}
            />
          </div>
        </div>
      )}
    </div>
  );
}
