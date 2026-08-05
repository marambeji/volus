import { AlertTriangle } from 'lucide-react';
import type { ReportOverlaps } from '../../services/reportsApi';
import { OverlapHistogram } from './reportCharts';

export default function OverlapsPanel({ data }: { data: ReportOverlaps }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Concurrent Absences</h3>
        <p className="text-xs text-slate-400 mb-4">Number of people absent per day</p>
        <OverlapHistogram data={data.dailyCounts} />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Overlapping Requests ({data.clusters.length})</span>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {data.clusters.length === 0 && (
            <div className="py-10 text-center text-slate-400 text-sm">No overlapping approved leave in this period</div>
          )}
          {data.clusters.map((cluster, i) => (
            <div key={i} className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle size={14} />
                {new Date(cluster.startDate).toLocaleDateString('en-GB')} → {new Date(cluster.endDate).toLocaleDateString('en-GB')}
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
