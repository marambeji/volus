import type { Employee } from '../../types';
import Badge from '../ui/Badge';

interface EmployeeCardProps {
  employee: Employee;
}

// Generate a consistent background color for the avatar
function getColor(name: string): string {
  const colors = [
    '#3B82F6', // blue
    '#6366F1', // indigo
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#F43F5E', // rose
    '#F97316', // orange
    '#14B8A6', // teal
    '#06B6D4', // cyan
    '#10B981', // emerald
    '#EAB308', // yellow
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

// SVG ring: full circle if dayAmount===1, half circle if dayAmount===0.5
function LeaveRing({ dayAmount }: { dayAmount: 1 | 0.5 | undefined }) {
  if (!dayAmount) return null;

  const size = 72;       // diameter of the ring overlay
  const strokeW = 3.5;
  const r = (size - strokeW) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  if (dayAmount === 1) {
    // Full green ring
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#22c55e"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Half green ring — top-right half only (like a 180° arc)
  const halfDash = circumference / 2;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: 'rotate(-90deg)' }}
    >
      {/* Gray placeholder for the other half */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      {/* Green half-arc */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#22c55e"
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeDasharray={`${halfDash} ${circumference}`}
        strokeDashoffset="0"
      />
    </svg>
  );
}

export default function EmployeeCard({ employee }: EmployeeCardProps) {
  const { name, department, status, leaveType, dayAmount } = employee;
  const bgColor = getColor(name);
  const initials = getInitials(name);

  const isHalfDay = dayAmount === 0.5;

  return (
    <div className="flex flex-col items-center gap-2.5 p-4 bg-gradient-to-b from-white to-blue-50/60 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-default">
      {/* Avatar with leave ring indicator */}
      <div className="relative" style={{ width: 72, height: 72 }}>
        {/* Avatar circle */}
        <div
          className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-base select-none shadow-md"
          style={{ backgroundColor: bgColor }}
        >
          {initials}
        </div>

        {/* Animated green ring (full or half) */}
        <LeaveRing dayAmount={dayAmount} />

        {/* Half-day label badge inside ring bottom */}
        {isHalfDay && (
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-400 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap leading-none">
            ½ Day
          </span>
        )}
      </div>

      {/* Name + Department */}
      <div className="text-center mt-1">
        <p className="text-slate-800 font-semibold text-sm leading-tight">{name}</p>
        <p className="text-slate-400 text-xs mt-0.5">{department}</p>
      </div>

      {/* Badges */}
      <div className="flex flex-col items-center gap-1">
        <Badge
          label={status === 'out-today' ? 'Out Today' : 'Out Tomorrow'}
          variant={status === 'out-today' ? 'today' : 'tomorrow'}
        />
        <Badge label={leaveType || 'Annual Leave'} variant="leave" />
      </div>
    </div>
  );
}
