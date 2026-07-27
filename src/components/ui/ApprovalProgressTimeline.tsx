import React from 'react';
import { Check, Clock, X, Circle, AlertCircle, Ban } from 'lucide-react';

export interface ApprovalStepItem {
  approvalInstanceId?: string;
  stepOrder: number;
  approverType: string;
  label: string;
  status: 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED' | 'CANCELLED' | string;
  actionDate?: string | null;
  decisionNote?: string | null;
}

export interface ApprovalProgressTimelineProps {
  submittedAt?: string;
  steps: ApprovalStepItem[];
  requestStatus?: string;
  rejectionReason?: string | null;
  className?: string;
  compact?: boolean;
}

export function formatRoleLabel(type: string, fallbackLabel?: string): string {
  if (fallbackLabel && fallbackLabel !== 'Approver') return fallbackLabel;
  switch (type) {
    case 'MANAGER':
      return "Employee’s Manager";
    case 'MANAGERS_MANAGER':
      return "Manager’s Manager";
    case 'SPECIFIC_PERSON':
      return 'Specific Approver';
    case 'HR':
      return 'HR Department';
    default:
      return fallbackLabel || 'Approver';
  }
}

export default function ApprovalProgressTimeline({
  submittedAt,
  steps = [],
  requestStatus = 'PENDING',
  rejectionReason,
  className = '',
  compact = false,
}: ApprovalProgressTimelineProps) {
  const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 overflow-x-auto py-1 ${className}`}>
        {/* Submitted Node */}
        <span
          className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0"
          title={`Submitted: ${submittedAt ? new Date(submittedAt).toLocaleDateString('en-GB') : ''}`}
        />
        <div className="w-3 h-0.5 bg-emerald-300 flex-shrink-0" />

        {sortedSteps.map((step, idx) => {
          const roleLabel = formatRoleLabel(step.approverType, step.label);
          let bgClass = 'bg-slate-300';
          if (step.status === 'APPROVED') bgClass = 'bg-emerald-500';
          else if (step.status === 'PENDING') bgClass = 'bg-violet-600 animate-pulse';
          else if (step.status === 'REJECTED') bgClass = 'bg-red-500';
          else if (step.status === 'SKIPPED') bgClass = 'bg-slate-300 opacity-50';

          return (
            <React.Fragment key={step.approvalInstanceId || idx}>
              <span
                className={`w-2.5 h-2.5 rounded-full ${bgClass} flex-shrink-0`}
                title={`Level ${step.stepOrder} (${roleLabel}): ${step.status}`}
              />
              {idx < sortedSteps.length - 1 && (
                <div
                  className={`w-3 h-0.5 flex-shrink-0 ${
                    step.status === 'APPROVED' ? 'bg-emerald-300' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
        {/* Submitted Step */}
        <div className="relative flex items-start gap-3">
          <span className="absolute -left-[24px] top-0.5 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold shadow-sm">
            <Check size={13} />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Request Submitted
            </p>
            {submittedAt && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                {new Date(submittedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>

        {/* Approval Levels */}
        {sortedSteps.map((step) => {
          const roleLabel = formatRoleLabel(step.approverType, step.label);
          const isApproved = step.status === 'APPROVED';
          const isPending = step.status === 'PENDING';
          const isRejected = step.status === 'REJECTED';
          const isSkipped = step.status === 'SKIPPED';
          const isWaiting = step.status === 'WAITING';

          return (
            <div key={step.approvalInstanceId || step.stepOrder} className="relative flex items-start gap-3">
              {isApproved && (
                <span className="absolute -left-[24px] top-0.5 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  <Check size={13} />
                </span>
              )}
              {isPending && (
                <span className="absolute -left-[24px] top-0.5 w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold shadow-sm animate-pulse ring-4 ring-violet-100 dark:ring-violet-950/50">
                  <Clock size={13} />
                </span>
              )}
              {isRejected && (
                <span className="absolute -left-[24px] top-0.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  <X size={13} />
                </span>
              )}
              {isSkipped && (
                <span className="absolute -left-[24px] top-0.5 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center text-xs font-bold">
                  <Ban size={12} />
                </span>
              )}
              {isWaiting && (
                <span className="absolute -left-[24px] top-0.5 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                  {step.stepOrder}
                </span>
              )}

              <div className="flex-1 bg-slate-50/80 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/80">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      Level {step.stepOrder}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {roleLabel}
                    </h4>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isApproved
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : isPending
                        ? 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300'
                        : isRejected
                        ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                        : isSkipped
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {step.status}
                  </span>
                </div>

                {step.actionDate && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Decision Date:{' '}
                    {new Date(step.actionDate).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}

                {step.decisionNote && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 italic bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                    "{step.decisionNote}"
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Final Decision */}
        <div className="relative flex items-start gap-3">
          {requestStatus === 'APPROVED' && (
            <span className="absolute -left-[24px] top-0.5 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-sm ring-4 ring-emerald-100 dark:ring-emerald-950/50">
              <Check size={14} />
            </span>
          )}
          {requestStatus === 'REJECTED' && (
            <span className="absolute -left-[24px] top-0.5 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold shadow-sm ring-4 ring-red-100 dark:ring-red-950/50">
              <X size={14} />
            </span>
          )}
          {requestStatus === 'PENDING' && (
            <span className="absolute -left-[24px] top-0.5 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center text-[10px] font-bold">
              <Clock size={12} />
            </span>
          )}
          {requestStatus === 'CANCELLED' && (
            <span className="absolute -left-[24px] top-0.5 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
              <Ban size={12} />
            </span>
          )}
          <div>
            <p
              className={`text-xs font-bold uppercase tracking-wider ${
                requestStatus === 'APPROVED'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : requestStatus === 'REJECTED'
                  ? 'text-red-600 dark:text-red-400'
                  : requestStatus === 'PENDING'
                  ? 'text-slate-500 dark:text-slate-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              Final Decision: {requestStatus === 'PENDING' ? 'WAITING' : requestStatus}
            </p>
            {rejectionReason && (
              <p className="text-xs text-red-600 dark:text-red-300 mt-1 italic bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-100 dark:border-red-900/40">
                Rejection Reason: {rejectionReason}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
