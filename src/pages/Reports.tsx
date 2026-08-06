import { useState, useEffect } from 'react';
import {
  CalendarDays,
  PieChart as PieIcon,
  Sun,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Download,
  Printer,
  Sparkles,
  Bot,
  AlertCircle,
  Calendar,
  Users,
} from 'lucide-react';
import StatCard from '../admin/components/ui/StatCard';
import ReportFilterBar from '../components/reports/ReportFilterBar';
import RequestsTable from '../components/reports/RequestsTable';
import BalancesTable from '../components/reports/BalancesTable';
import OverlapsPanel from '../components/reports/OverlapsPanel';
import { MonthlyUsageBarChart, UsagePieChart } from '../components/reports/reportCharts';
import NovelusPdfReport from '../components/reports/NovelusPdfReport';
import {
  getRequestsReport,
  getBalancesReport,
  getOverlapsReport,
  type ReportRequestRow,
  type ReportBalanceRow,
  type ReportOverlaps,
} from '../services/reportsApi';
import { getLeaveTypes, type LeaveTypeItem } from '../services/leaveTypesApi';
import { apiFetch } from '../services/apiClient';

const SUMMER_MONTHS = ['Jun', 'Jul', 'Aug'];
const SUMMER_MONTH_NUMS = [6, 7, 8];

function currentUser(): { id: string; name?: string; role: 'admin' | 'manager' | 'employee' } {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{"role":"employee"}');
  } catch {
    return { id: '', role: 'employee' };
  }
}

// ── CSV export utility ───────────────────────────────────────────────────────

function exportCsvRequests(rows: ReportRequestRow[], filename: string) {
  const headers = ['Employee', 'Department', 'Country', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Submitted On'];
  const lines = rows.map(r => [
    r.employeeName,
    r.department ?? '',
    r.country ?? '',
    r.leaveTypeName,
    r.startDate,
    r.endDate,
    r.durationDays,
    r.status,
    r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
  const csv = [headers.join(';'), ...lines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsvBalances(rows: ReportBalanceRow[], filename: string) {
  const typeKeys = Array.from(new Set(rows.flatMap(r => Object.keys(r.balances || {})))).sort();
  const headers = ['Employee', 'Department', 'Country', ...typeKeys.map(k => `${k} (avail)`), 'Total Available'];
  const lines = rows.map(r => [
    r.employeeName,
    r.department ?? '',
    r.country ?? '',
    ...typeKeys.map(k => r.balances[k]?.available ?? ''),
    r.totalAvailable ?? '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
  const csv = [headers.join(';'), ...lines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Root router ──────────────────────────────────────────────────────────────

export default function Reports() {
  const user = currentUser();
  return user.role === 'manager' ? <ManagerReports user={user} /> : <EmployeeReports />;
}

// ── Manager: team reports with PDF + CSV export ──────────────────────────────

function ManagerReports({ user }: { user: { id: string; name?: string; role: string } }) {
  const [tab, setTab] = useState<'balances' | 'requests' | 'overlaps'>('balances');
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');

  const [requestsData, setRequestsData] = useState<ReportRequestRow[]>([]);
  const [balancesData, setBalancesData] = useState<ReportBalanceRow[]>([]);
  const [overlapsData, setOverlapsData] = useState<ReportOverlaps | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getLeaveTypes(controller.signal).then(setLeaveTypes).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = { dateFrom, dateTo, leaveTypeId };
    Promise.all([
      getRequestsReport(query, controller.signal).then(setRequestsData).catch(() => {}),
      getBalancesReport(query, controller.signal).then(setBalancesData).catch(() => {}),
      getOverlapsReport(query, controller.signal).then(setOverlapsData).catch(() => {}),
    ]).finally(() => setLoading(false));
    return () => controller.abort();
  }, [dateFrom, dateTo, leaveTypeId]);

  const searchedRequests = requestsData.filter(r => r.employeeName.toLowerCase().includes(search.toLowerCase()));
  const searchedBalances = balancesData.filter(b => b.employeeName.toLowerCase().includes(search.toLowerCase()));

  const monthlyRequestCounts = (() => {
    const counts = new Map<string, number>();
    requestsData.forEach(r => {
      const month = new Date(r.startDate).toLocaleString('en', { month: 'short' });
      counts.set(month, (counts.get(month) ?? 0) + 1);
    });
    const order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return order.filter(m => counts.has(m)).map(m => ({ month: m, value: counts.get(m)! }));
  })();

  const dateLabel = new Date().toISOString().split('T')[0];

  function handleCsvExport() {
    if (tab === 'requests') {
      exportCsvRequests(searchedRequests, `novelus_requests_report_${dateLabel}.csv`);
    } else if (tab === 'balances') {
      exportCsvBalances(searchedBalances, `novelus_balances_report_${dateLabel}.csv`);
    } else {
      if (!overlapsData) return;
      const lines = overlapsData.clusters.map(c =>
        `"${c.startDate}";"${c.endDate}";"${c.requests.map(r => r.employeeName).join(', ')}";"${c.requests.length}"`
      );
      const csv = ['"Start";"End";"Employees Concerned";"Count"', ...lines].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novelus_overlaps_report_${dateLabel}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  const canExportCsv = tab === 'requests'
    ? searchedRequests.length > 0
    : tab === 'balances'
    ? searchedBalances.length > 0
    : !!overlapsData;

  // AI Smart Insights live calculations
  const negativeBalances = balancesData.filter(b => (b.totalAvailable ?? 0) < 0);
  const totalApprovedDays = requestsData.filter(r => r.status === 'APPROVED').reduce((s, r) => s + r.durationDays, 0);

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Team Reports</h1>
            <span className="inline-flex items-center gap-1 bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-violet-200 dark:border-violet-800">
              <Sparkles size={11} className="text-violet-600 animate-pulse" /> AI Manager Analytics
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">Intelligent analytics &amp; leave management for your team</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* CSV Export */}
          <button
            onClick={handleCsvExport}
            disabled={!canExportCsv}
            title="Export filtered data to CSV"
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-600 rounded-xl text-sm shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={15} /> Export CSV
          </button>
          {/* PDF Report */}
          <NovelusPdfReport
            managerName={user.name || 'Manager'}
            requests={requestsData}
            balances={balancesData}
            overlaps={overlapsData}
            filters={{ dateFrom, dateTo }}
          />
        </div>
      </div>

      {/* 🤖 AI Smart Report & Manager Insights Banner */}
      <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 text-white rounded-2xl p-6 shadow-xl border border-violet-500/30 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
            <Bot size={18} className="text-violet-200" />
          </div>
          <div>
            <h2 className="font-extrabold text-base tracking-wide flex items-center gap-2">
              AI Smart Report &amp; Manager Insights
            </h2>
            <p className="text-xs text-violet-100/80">Real-time automated contextual analytics</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Insight 1: Balance Audit */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-violet-200 flex items-center gap-1">
                <AlertCircle size={12} className="text-amber-300" /> Balance Audits
              </span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${negativeBalances.length > 0 ? 'bg-red-500/80 text-white' : 'bg-emerald-500/80 text-white'}`}>
                {negativeBalances.length > 0 ? 'Action required' : 'Optimal'}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-sm font-bold text-white">
                {negativeBalances.length > 0
                  ? `${negativeBalances.length} employee(s) with negative balance`
                  : 'All balances are positive'}
              </p>
              <p className="text-xs text-violet-100/90 mt-1">
                {negativeBalances.length > 0
                  ? `Example: ${negativeBalances[0].employeeName} (${negativeBalances[0].totalAvailable}d). Adjustment required.`
                  : 'No leave overdraw detected within the team.'}
              </p>
            </div>
          </div>

          {/* Insight 2: Peak Season */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-violet-200 flex items-center gap-1">
                <Calendar size={12} className="text-sky-300" /> Peak Absence Season
              </span>
              <span className="text-[10px] font-extrabold bg-sky-500/80 text-white px-2 py-0.5 rounded-full">
                Planning
              </span>
            </div>
            <div className="mt-3">
              <p className="text-sm font-bold text-white">
                {totalApprovedDays} approved absence days
              </p>
              <p className="text-xs text-violet-100/90 mt-1">
                High concentration during summer &amp; year-end periods.
              </p>
            </div>
          </div>

          {/* Insight 3: Coverage Risk */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-violet-200 flex items-center gap-1">
                <Users size={12} className="text-emerald-300" /> Team Coverage Risk
              </span>
              <span className="text-[10px] font-extrabold bg-indigo-500/80 text-white px-2 py-0.5 rounded-full">
                {overlapsData ? `${overlapsData.clusters.length} clusters` : 'Analytics'}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-sm font-bold text-white">
                {overlapsData && overlapsData.clusters.length > 0
                  ? `Peak at ${overlapsData.peakConcurrent} simultaneous employees`
                  : 'Balanced team coverage'}
              </p>
              <p className="text-xs text-violet-100/90 mt-1">
                {overlapsData && overlapsData.clusters.length > 0
                  ? 'Check the Overlaps tab to anticipate skill handovers.'
                  : 'No major understaffing risk identified.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div className="grid grid-cols-3 gap-3 max-w-lg">
        {[
          { key: 'balances', label: 'Balances', icon: PieIcon },
          { key: 'requests', label: 'Requests', icon: TrendingUp },
          { key: 'overlaps', label: 'Overlaps', icon: AlertTriangle },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
              tab === t.key
                ? 'border-violet-500 text-violet-600 dark:text-violet-400 bg-white dark:bg-slate-800 shadow-md ring-2 ring-violet-500/20'
                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <ReportFilterBar
        search={tab !== 'overlaps' ? search : undefined}
        onSearchChange={tab !== 'overlaps' ? setSearch : undefined}
        searchPlaceholder="Search team member..."
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        leaveTypeOptions={leaveTypes.map(t => ({ label: t.label, value: t.id }))}
        leaveTypeId={leaveTypeId}
        onLeaveTypeChange={tab !== 'overlaps' ? setLeaveTypeId : undefined}
      />

      {/* Content */}
      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm flex justify-center items-center gap-2">
          <RefreshCw size={16} className="animate-spin text-violet-600" /> Loading...
        </div>
      ) : tab === 'balances' ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <BalancesTable rows={searchedBalances} />
        </div>
      ) : tab === 'requests' ? (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Requests by month</h3>
            <MonthlyUsageBarChart data={monthlyRequestCounts} label="Requests" highlightMonths={SUMMER_MONTHS} />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <RequestsTable rows={searchedRequests} />
          </div>
        </>
      ) : (
        overlapsData && <OverlapsPanel data={overlapsData} />
      )}
    </div>
  );
}

// ── Employee: personal stats only ───────────────────────────────────────────

function EmployeeReports() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [requests, setRequests] = useState<ReportRequestRow[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getLeaveTypes(controller.signal),
      apiFetch<any>('/employees/me/leave-balances', { signal: controller.signal }),
    ])
      .then(([types, balancesRes]) => {
        setLeaveTypes(types);
        setBalances(balancesRes?.balances ?? []);
      })
      .catch(err => {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Failed to load employee balances:', err);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getRequestsReport({ dateFrom, dateTo, leaveTypeId }, controller.signal)
      .then(setRequests)
      .catch(err => {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Failed to load my requests report:', err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [dateFrom, dateTo, leaveTypeId]);

  const annualBalance = balances.find(b => b.code === 'annual');
  const pctAnnualUsed = annualBalance && annualBalance.entitlement > 0
    ? Math.round((annualBalance.used / annualBalance.entitlement) * 100)
    : 0;

  const approvedRequests = requests.filter(r => r.status === 'APPROVED');
  const totalDaysUsed = approvedRequests.reduce((sum, r) => sum + r.durationDays, 0);
  const summerDays = approvedRequests
    .filter(r => SUMMER_MONTH_NUMS.includes(new Date(r.startDate).getMonth() + 1))
    .reduce((sum, r) => sum + r.durationDays, 0);
  const pctSummer = totalDaysUsed > 0 ? Math.round((summerDays / totalDaysUsed) * 100) : 0;

  const usageByType = balances
    .filter(b => b.used > 0)
    .map(b => ({ name: b.name || b.code, value: b.used }));

  const monthlyDaysUsed = (() => {
    const totals = new Map<string, number>();
    approvedRequests.forEach(r => {
      const month = new Date(r.startDate).toLocaleString('en', { month: 'short' });
      totals.set(month, (totals.get(month) ?? 0) + r.durationDays);
    });
    const order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return order.filter(m => totals.has(m)).map(m => ({ month: m, value: totals.get(m)! }));
  })();

  function handleExportCsv() {
    exportCsvRequests(requests, `novelus_mes_demandes_${new Date().toISOString().split('T')[0]}.csv`);
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">My Leave Report</h1>
          <p className="text-slate-400 text-sm mt-1">Your personal usage for the year</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            disabled={requests.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-600 rounded-xl text-sm shadow-sm transition-all cursor-pointer disabled:opacity-40"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-600 rounded-xl text-sm shadow-sm transition-all cursor-pointer"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Annual Leave Used" value={`${pctAnnualUsed}%`} icon={<PieIcon size={18} />} color="bg-violet-500" />
        <StatCard title="Days Used" value={totalDaysUsed} icon={<CalendarDays size={18} />} color="bg-blue-500" />
        <StatCard title="Taken in Summer" value={`${pctSummer}%`} icon={<Sun size={18} />} color="bg-amber-500" subtitle="June – August" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Usage by Leave Type</h3>
          <UsagePieChart data={usageByType} />
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Days Taken by Month</h3>
          <MonthlyUsageBarChart data={monthlyDaysUsed} label="Days" highlightMonths={SUMMER_MONTHS} />
        </div>
      </div>

      <ReportFilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        leaveTypeOptions={leaveTypes.map(t => ({ label: t.label, value: t.id }))}
        leaveTypeId={leaveTypeId}
        onLeaveTypeChange={setLeaveTypeId}
      />

      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm flex justify-center items-center gap-2">
          <RefreshCw size={16} className="animate-spin text-violet-600" /> Loading...
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <RequestsTable rows={requests} />
        </div>
      )}
    </div>
  );
}
