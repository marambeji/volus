interface BadgeProps {
  label: string;
  variant?: 'today' | 'tomorrow' | 'department' | 'leave';
}

const variants = {
  today:      'bg-amber-100 text-amber-700 border border-amber-200',
  tomorrow:   'bg-blue-100 text-blue-700 border border-blue-200',
  department: 'bg-slate-100 text-slate-600 border border-slate-200',
  leave:      'bg-purple-100 text-purple-700 border border-purple-200',
};

export default function Badge({ label, variant = 'department' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {label}
    </span>
  );
}
