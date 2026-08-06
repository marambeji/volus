import { AlertTriangle, Users } from 'lucide-react';
import type { ReportOverlaps } from '../../services/reportsApi';
import { OverlapHistogram } from './reportCharts';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OverlapsPanel({ data }: { data: ReportOverlaps }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/80 p-6 shadow-sm">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-1">
          Concurrent Team Absences
        </h3>
        <p className="text-xs text-slate-400 mb-5">Number of direct reports absent per day</p>
        <OverlapHistogram data={data.dailyCounts} />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Overlapping Leave Windows ({data.clusters.length})
          </span>
          <Users size={16} className="text-slate-400" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {data.clusters.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm font-medium">
              No overlapping approved leave detected for this period.
            </div>
          ) : (
            data.clusters.map((cluster, i) => (
              <div key={i} className="p-5 flex flex-col gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition">
                <div className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>
                    {fmtDate(cluster.startDate)} &#8594; {fmtDate(cluster.endDate)}
                  </span>
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
                    {cluster.requests.length} members overlapping
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {cluster.requests.map((r) => (
                    <span
                      key={r.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-600/60 flex items-center gap-2"
                    >
                      <span>{r.employeeName}</span>
                      <span className="text-slate-400 font-normal">&middot;</span>
                      <span className="text-violet-600 dark:text-violet-400">{r.leaveTypeName}</span>
                      <span className="text-slate-400 font-normal">({fmtDate(r.startDate)} - {fmtDate(r.endDate)})</span>
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
