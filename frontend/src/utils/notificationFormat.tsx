import type { ReactElement } from 'react';
import { CheckCircle2, XCircle, Clock, Trash2, Info } from 'lucide-react';

export interface NotificationLike {
  actionType: string;
  actorName: string;
  reason?: string | null;
  newValues?: any;
}

export interface FormattedNotification {
  title: string;
  desc: string;
  icon: ReactElement;
  color: string;
}

export function getCurrentUserId(): string | null {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{}').id ?? null;
  } catch {
    return null;
  }
}

/**
 * Builds viewer-aware notification copy ("Your request…" vs "X submitted a
 * request awaiting your review…") instead of the actor-centric audit
 * description, which reads oddly in a personal notification feed.
 */
export function formatNotification(n: NotificationLike, currentUserId: string | null): FormattedNotification {
  const actor = n.actorName || 'System';
  const reasonStr = n.reason ? ` — note: "${n.reason}"` : '';
  const leaveType = n.newValues?.leaveType?.label || 'leave';

  switch (n.actionType) {
    case 'LEAVE_REQUEST_SUBMITTED': {
      const requesterId = n.newValues?.employeeId;
      if (requesterId && requesterId !== currentUserId) {
        const requesterName = n.newValues?.employee?.fullName || actor;
        return {
          title: 'New Leave Request',
          desc: `${requesterName} submitted a ${leaveType} request awaiting your review.`,
          icon: <Clock size={16} className="text-amber-500" />,
          color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
        };
      }
      return {
        title: 'Leave Request Submitted',
        desc: `Your ${leaveType} request has been submitted and is pending approval.`,
        icon: <Clock size={16} className="text-indigo-500" />,
        color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
      };
    }
    case 'LEAVE_REQUEST_APPROVED':
      return {
        title: 'Leave Request Approved 🎉',
        desc: `Your ${leaveType} request was approved by ${actor}${reasonStr}.`,
        icon: <CheckCircle2 size={16} className="text-emerald-500" />,
        color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      };
    case 'LEAVE_REQUEST_REJECTED':
      return {
        title: 'Leave Request Rejected',
        desc: `Your ${leaveType} request was rejected by ${actor}${reasonStr}.`,
        icon: <XCircle size={16} className="text-red-500" />,
        color: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      };
    case 'LEAVE_REQUEST_CANCELLED':
      return {
        title: 'Leave Request Cancelled',
        desc: `Your ${leaveType} request was cancelled${reasonStr}.`,
        icon: <Info size={16} className="text-slate-500" />,
        color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
    case 'LEAVE_REQUEST_DELETED_BY_HR':
      return {
        title: 'Leave Request Deleted by HR',
        desc: `Your ${leaveType} request was deleted by ${actor}${reasonStr}.`,
        icon: <Trash2 size={16} className="text-red-500" />,
        color: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      };
    default:
      return {
        title: n.actionType.replace(/_/g, ' '),
        desc: `${actor} performed ${n.actionType.toLowerCase().replace(/_/g, ' ')}${reasonStr}.`,
        icon: <Info size={16} className="text-slate-500" />,
        color: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
  }
}
