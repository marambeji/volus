import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// Same palette as AdminDashboard.tsx — keep chart colors consistent across the app.
export const CHART_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#F97316', '#6B7280', '#06B6D4'];

const tooltipStyle = { borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 };

function EmptyChart({ label }: { label: string }) {
  return <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">{label}</div>;
}

// Bar chart of "days" (or "requests") per calendar month — used for
// "most-used periods" (Admin/Manager) and "days taken per month" (Employee).
export function MonthlyUsageBarChart({
  data,
  dataKey = 'value',
  label = 'Days',
  color = '#8B5CF6',
  highlightMonths = [],
}: {
  data: Array<{ month: string; value: number }>;
  dataKey?: string;
  label?: string;
  color?: string;
  highlightMonths?: string[];
}) {
  if (data.length === 0) return <EmptyChart label="No data for this period" />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, label]} />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={highlightMonths.includes(d.month) ? '#F59E0B' : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Generic breakdown bar chart — "absences by country/department".
export function BreakdownChart({ data, label = 'Value' }: { data: Array<{ name: string; value: number }>; label?: string }) {
  if (data.length === 0) return <EmptyChart label="No data" />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={90} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, label]} />
        <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Histogram of concurrent-absence counts per day — visualizes overlaps.
export function OverlapHistogram({ data }: { data: Array<{ date: string; count: number }> }) {
  if (data.length === 0) return <EmptyChart label="No overlapping absences in this period" />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, 'People absent']} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.count >= 2 ? '#EF4444' : '#8B5CF6'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Personal "used vs remaining" donut, per leave type.
export function UsagePieChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) return <EmptyChart label="No usage recorded" />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={filtered} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
          {filtered.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
