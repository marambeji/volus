import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ReportOverlaps } from '../../services/reportsApi';
import { OverlapHistogram, ActiveFilterChip } from './reportCharts';

export default function OverlapsPanel({ data }: { data: ReportOverlaps }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Filter at the request level, not the cluster level — a cluster's overall
  // span (e.g. 23/08–23/10) can be much wider than any single day within it,
  // so only keep the requests that actually cover the clicked day.
  const filteredClusters = selectedDate
    ? data.clusters
        .map((c) => ({
          ...c,
          requests: c.requests.filter((r) => r.startDate <= selectedDate && r.endDate >= selectedDate),
        }))
        .filter((c) => c.requests.length > 0)
    : data.clusters;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Concurrent Absences</h3>
        <p className="text-xs text-slate-400 mb-4">Number of people absent per day — click a bar to filter the list below</p>
        <OverlapHistogram
          data={data.dailyCounts}
          onBarClick={(date) => setSelectedDate((prev) => (prev === date ? null : date))}
          activeKey={selectedDate}
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Overlapping Requests ({filteredClusters.length})</span>
        </div>
        {selectedDate && (
          <div className="px-4 pt-4">
            <ActiveFilterChip
              label={new Date(selectedDate).toLocaleDateString('en-GB')}
              onClear={() => setSelectedDate(null)}
            />
          </div>
        )}
        <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {filteredClusters.length === 0 && (
            <div className="py-10 text-center text-slate-400 text-sm">
              {selectedDate && (data.dailyCounts.find((d) => d.date === selectedDate)?.count ?? 0) < 2
                ? 'Only one person is absent on this day — not an overlap.'
                : 'No overlapping approved leave in this period'}
            </div>
          )}
          {filteredClusters.map((cluster, i) => (
            <div key={i} className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle size={14} />
                {selectedDate
                  ? `On ${new Date(selectedDate).toLocaleDateString('en-GB')}`
                  : `${new Date(cluster.startDate).toLocaleDateString('en-GB')} → ${new Date(cluster.endDate).toLocaleDateString('en-GB')}`}
                <span className="text-slate-400 font-normal">({cluster.requests.length} people)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {cluster.requests.map((r) => (
                  <span key={r.id} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {r.employeeName} · {r.leaveTypeName} · {new Date(r.startDate).toLocaleDateString('en-GB')}–{new Date(r.endDate).toLocaleDateString('en-GB')}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
