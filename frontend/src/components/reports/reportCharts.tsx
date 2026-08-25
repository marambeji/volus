import { X } from 'lucide-react';
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

// Small pill shown above a table when a chart bar has been clicked to filter
// it — click the × (or "Show all") to clear. Keeps chart-click-to-filter UX
// consistent across Requests / Balances / Overlaps.
export function ActiveFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="inline-flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 text-xs font-bold pl-3 pr-1.5 py-1 rounded-full">
        Filtered by: {label}
        <button
          onClick={onClear}
          className="p-0.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-800 transition-colors cursor-pointer"
          title="Clear filter"
        >
          <X size={12} />
        </button>
      </span>
      <button
        onClick={onClear}
        className="text-xs font-semibold text-slate-400 hover:text-violet-600 transition-colors cursor-pointer"
      >
        Show all
      </button>
    </div>
  );
}

// Bar chart of "days" (or "requests") per calendar month — used for
// "most-used periods" (Admin/Manager) and "days taken per month" (Employee).
// Clickable: onBarClick(month) toggles a filter in the parent; activeKey
// highlights the selected bar and dims the rest.
export function MonthlyUsageBarChart({
  data,
  dataKey = 'value',
  label = 'Days',
  color = '#8B5CF6',
  highlightMonths = [],
  onBarClick,
  activeKey,
}: {
  data: Array<{ month: string; value: number }>;
  dataKey?: string;
  label?: string;
  color?: string;
  highlightMonths?: string[];
  onBarClick?: (month: string) => void;
  activeKey?: string | null;
}) {
  if (data.length === 0) return <EmptyChart label="No data for this period" />;
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, label]} />
          <Bar
            dataKey={dataKey}
            radius={[4, 4, 0, 0]}
            onClick={onBarClick ? (d: any) => onBarClick(d.month) : undefined}
            cursor={onBarClick ? 'pointer' : undefined}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={highlightMonths.includes(d.month) ? '#F59E0B' : color}
                opacity={!activeKey || activeKey === d.month ? 1 : 0.3}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Permanently Visible Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs font-semibold">
        {highlightMonths.length > 0 ? (
          <>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="w-3 h-3 rounded-sm bg-[#8B5CF6] inline-block shadow-2xs" />
              <span>Standard Months ({label})</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="w-3 h-3 rounded-sm bg-[#F59E0B] inline-block shadow-2xs" />
              <span>Peak Summer Period ({highlightMonths.join(', ')})</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="w-3 h-3 rounded-sm bg-[#8B5CF6] inline-block shadow-2xs" />
            <span>Monthly {label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Generic breakdown bar chart — "absences by country/department/employee".
// Clickable: onBarClick(name) toggles a filter in the parent; activeKey
// highlights the selected bar and dims the rest.
export function BreakdownChart({
  data,
  label = 'Value',
  onBarClick,
  activeKey,
}: {
  data: Array<{ name: string; value: number }>;
  label?: string;
  onBarClick?: (name: string) => void;
  activeKey?: string | null;
}) {
  if (data.length === 0) return <EmptyChart label="No data" />;
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={90} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, label]} />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            onClick={onBarClick ? (d: any) => onBarClick(d.name) : undefined}
            cursor={onBarClick ? 'pointer' : undefined}
          >
            {data.map((d, i) => (
              <Cell key={i} fill="#8B5CF6" opacity={!activeKey || activeKey === d.name ? 1 : 0.3} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Permanently Visible Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs font-semibold">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="w-3 h-3 rounded-sm bg-[#8B5CF6] inline-block shadow-2xs" />
          <span>{label} per Category</span>
        </div>
      </div>
    </div>
  );
}

// Histogram of concurrent-absence counts per day — visualizes overlaps.
// Clickable: onBarClick(date) toggles a filter in the parent; activeKey
// highlights the selected bar and dims the rest.
export function OverlapHistogram({
  data,
  onBarClick,
  activeKey,
}: {
  data: Array<{ date: string; count: number }>;
  onBarClick?: (date: string) => void;
  activeKey?: string | null;
}) {
  if (data.length === 0) return <EmptyChart label="No overlapping absences in this period" />;
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, 'People absent']} />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            onClick={onBarClick ? (d: any) => onBarClick(d.date) : undefined}
            cursor={onBarClick ? 'pointer' : undefined}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.count >= 2 ? '#EF4444' : '#8B5CF6'}
                opacity={!activeKey || activeKey === d.date ? 1 : 0.3}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Permanently Visible Legend */}
      <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs font-semibold">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="w-3 h-3 rounded-sm bg-[#8B5CF6] inline-block shadow-2xs" />
          <span>Single Absence (1 Person)</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="w-3 h-3 rounded-sm bg-[#EF4444] inline-block shadow-2xs" />
          <span>Simultaneous Overlap (2+ People)</span>
        </div>
      </div>
    </div>
  );
}

// Personal "used vs remaining" donut, per leave type.
export function UsagePieChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) return <EmptyChart label="No usage recorded" />;
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={filtered} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
            {filtered.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>

      {/* Permanently Visible Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-2 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs font-semibold">
        {filtered.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="w-3 h-3 rounded-full inline-block shadow-2xs" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
            <span>{entry.name}: <strong>{entry.value}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}
