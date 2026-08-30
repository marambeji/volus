type Variant = 'approved' | 'pending' | 'declined' | 'cancelled' | 'deleted_by_hr' | 'active' | 'inactive' | 'archived' | 'on_leave' | 'info';

const styles: Record<Variant, string> = {
  approved:  'bg-emerald-50 text-emerald-700 border border-emerald-100',
  pending:   'bg-amber-50 text-amber-700 border border-amber-100',
  declined:  'bg-red-50 text-red-700 border border-red-100',
  cancelled: 'bg-slate-100 text-slate-500 border border-slate-200',
  deleted_by_hr: 'bg-red-50 text-red-700 border border-red-100',
  active:    'bg-emerald-50 text-emerald-700 border border-emerald-100',
  inactive:  'bg-slate-100 text-slate-500 border border-slate-200',
  archived:  'bg-orange-50 text-orange-600 border border-orange-100',
  on_leave:  'bg-amber-50 text-amber-700 border border-amber-200',
  info:      'bg-violet-50 text-violet-700 border border-violet-100',
};

const labels: Record<Variant, string> = {
  approved:  'Approved',
  pending:   'Pending',
  declined:  'Declined',
  cancelled: 'Cancelled',
  deleted_by_hr: 'Deleted by HR',
  active:    'Active',
  inactive:  'Inactive',
  archived:  'Archived',
  on_leave:  'On Leave',
  info:      'Info',
};

const dots: Partial<Record<Variant, string>> = {
  active:   'bg-emerald-500',
  inactive: 'bg-slate-400',
  on_leave: 'bg-amber-400',
};

export default function StatusBadge({ status, label }: { status: Variant; label?: string }) {
  const dot = dots[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${styles[status]}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot} ${status === 'on_leave' ? 'animate-pulse' : ''}`} />
      )}
      {label ?? labels[status]}
    </span>
  );
}
