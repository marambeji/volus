import { useState, useEffect, useMemo } from 'react';
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
import { MonthlyUsageBarChart, UsagePieChart, BreakdownChart, ActiveFilterChip } from '../components/reports/reportCharts';
import NovelusPdfReport, { generatePdfReportDirect } from '../components/reports/NovelusPdfReport';
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

  // Chart-click-to-filter state (cleared whenever the tab changes)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedEmployeeChart, setSelectedEmployeeChart] = useState<string | null>(null);
  useEffect(() => { setSelectedMonth(null); setSelectedEmployeeChart(null); }, [tab]);

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

  const searchedRequests = requestsData
    .filter(r => r.employeeName.toLowerCase().includes(search.toLowerCase()))
    .filter(r => !selectedMonth || new Date(r.startDate).toLocaleString('en', { month: 'short' }) === selectedMonth);
  const searchedBalances = balancesData
    .filter(b => b.employeeName.toLowerCase().includes(search.toLowerCase()))
    .filter(b => !selectedEmployeeChart || b.employeeName === selectedEmployeeChart);

  const daysUsedByEmployee = balancesData
    .filter(b => b.employeeName.toLowerCase().includes(search.toLowerCase()))
    .map(b => ({ name: b.employeeName, value: Object.values(b.balances).reduce((s, v) => s + v.used, 0) }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

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
    <div className="w-full flex flex-col gap-6">

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
            teamOnly
          />
        </div>
      </div>

      {/* 🤖 AI Smart Report & Manager Insights Banner */}
      <div className="bg-gradient-to-br from-[#1b2559] via-[#16224F] to-[#111c44] text-white rounded-2xl p-6 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
            <Bot size={18} className="text-violet-200" />
          </div>
          <div>
            <h2 className="font-extrabold text-base tracking-wide flex items-center gap-2">
               Smart Report &amp; Manager Insights
            </h2>
            <p className="text-xs text-violet-100/80">Real-time automated contextual analytics</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Insight 1: Balance Audit */}
          <div className="bg-white/15 backdrop-blur-sm border border-white/25 shadow-md shadow-black/10 rounded-xl p-4 flex flex-col justify-between">
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
          <div className="bg-white/15 backdrop-blur-sm border border-white/25 shadow-md shadow-black/10 rounded-xl p-4 flex flex-col justify-between">
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
          <div className="bg-white/15 backdrop-blur-sm border border-white/25 shadow-md shadow-black/10 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-violet-200 flex items-center gap-1">
                <Users size={12} className="text-emerald-300" /> Team Coverage Risk
              </span>
              <span className="text-[10px] font-extrabold bg-emerald-500/80 text-white px-2 py-0.5 rounded-full">
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
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Days used by employee</h3>
            <p className="text-xs text-slate-400 mb-4">Click a bar to filter the table below</p>
            <BreakdownChart
              data={daysUsedByEmployee}
              label="Days used"
              onBarClick={(name) => setSelectedEmployeeChart(prev => prev === name ? null : name)}
              activeKey={selectedEmployeeChart}
            />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            {selectedEmployeeChart && (
              <div className="px-4 pt-4">
                <ActiveFilterChip label={selectedEmployeeChart} onClear={() => setSelectedEmployeeChart(null)} />
              </div>
            )}
            <BalancesTable rows={searchedBalances} />
          </div>
        </>
      ) : tab === 'requests' ? (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Requests by month</h3>
            <p className="text-xs text-slate-400 mb-4">Click a bar to filter the table below</p>
            <MonthlyUsageBarChart
              data={monthlyRequestCounts}
              label="Requests"
              highlightMonths={SUMMER_MONTHS}
              onBarClick={(month) => setSelectedMonth(prev => prev === month ? null : month)}
              activeKey={selectedMonth}
            />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            {selectedMonth && (
              <div className="px-4 pt-4">
                <ActiveFilterChip label={selectedMonth} onClear={() => setSelectedMonth(null)} />
              </div>
            )}
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
  const currentYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [requests, setRequests] = useState<ReportRequestRow[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch employee name from localStorage
  const currentUserObj = (() => {
    try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch { return {}; }
  })();
  const employeeName: string = currentUserObj?.name || currentUserObj?.fullName || 'Employee';

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

  const mappedBalanceRows: ReportBalanceRow[] = useMemo(() => [{
    employeeId: currentUserObj.id || 'me',
    employeeName: employeeName,
    department: currentUserObj.department || 'Employee',
    country: currentUserObj.country || null,
    balances: balances.reduce((acc, b) => {
      const label = b.name || b.code || 'Leave';
      acc[label] = {
        entitlement: b.entitlement ?? 0,
        used: b.used ?? 0,
        available: b.available ?? ((b.entitlement ?? 0) - (b.used ?? 0)),
      };
      return acc;
    }, {} as Record<string, { entitlement: number; used: number; available: number }>),
    totalAvailable: balances.reduce((sum, b) => sum + (b.available ?? ((b.entitlement ?? 0) - (b.used ?? 0))), 0),
  }], [balances, currentUserObj, employeeName]);

  // Leave type color palette
  const typeColors = [
    { bg: 'bg-violet-500', light: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-300', bar: '#7c3aed' },
    { bg: 'bg-blue-500',   light: 'bg-blue-100 dark:bg-blue-950/40',     text: 'text-blue-700 dark:text-blue-300',     bar: '#2563eb' },
    { bg: 'bg-emerald-500',light: 'bg-emerald-100 dark:bg-emerald-950/40',text:'text-emerald-700 dark:text-emerald-300',bar: '#059669' },
    { bg: 'bg-amber-500',  light: 'bg-amber-100 dark:bg-amber-950/40',   text: 'text-amber-700 dark:text-amber-300',   bar: '#d97706' },
    { bg: 'bg-rose-500',   light: 'bg-rose-100 dark:bg-rose-950/40',     text: 'text-rose-700 dark:text-rose-300',     bar: '#e11d48' },
    { bg: 'bg-cyan-500',   light: 'bg-cyan-100 dark:bg-cyan-950/40',     text: 'text-cyan-700 dark:text-cyan-300',     bar: '#0891b2' },
  ];

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── Branded Header ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#1b2559] via-[#16224F] to-[#111c44] text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-white/5 rounded-full" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          {/* Logo + title */}
          <div className="flex items-center gap-4">
            {/* Novelus SVG icon */}
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="27" fill="none" viewBox="0 0 48 46">
                <path fill="white" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-xl tracking-wide">NOVELUS</span>
                <span className="bg-white/20 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider">HR</span>
              </div>
              <p className="text-violet-200 text-xs font-medium mt-0.5">Leave Management Platform</p>
            </div>
          </div>

          {/* Right: employee info + actions */}
          <div className="flex flex-col sm:items-end gap-3">
            <div className="text-right">
              <div className="flex sm:justify-end items-center gap-2">
                <Users size={14} className="text-violet-300" />
                <span className="text-white font-bold text-base">{employeeName}</span>
              </div>
              <p className="text-violet-300 text-xs mt-0.5">Personal Leave Report · {currentYear}</p>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={handleExportCsv}
                disabled={requests.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white font-bold border border-white/20 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-40"
              >
                <Download size={12} /> Export CSV
              </button>
              <button
                type="button"
                onClick={() => generatePdfReportDirect({
                  managerName: employeeName,
                  requests,
                  balances: mappedBalanceRows,
                  overlaps: null,
                  filters: {
                    periodLabel: `Full Year ${currentYear}`,
                    employeeName: employeeName,
                    isEmployeePersonal: true,
                  },
                })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white font-bold border border-white/20 rounded-xl text-xs transition-all cursor-pointer"
              >
                <Printer size={12} /> Export PDF Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick stat cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Annual Leave Used" value={`${pctAnnualUsed}%`} icon={<PieIcon size={18} />} color="bg-violet-500" />
        <StatCard title="Days Used" value={totalDaysUsed} icon={<CalendarDays size={18} />} color="bg-blue-500" />
        <StatCard title="Taken in Summer" value={`${pctSummer}%`} icon={<Sun size={18} />} color="bg-amber-500" subtitle="June – August" />
      </div>

      {/* ── Leave Days Breakdown ─────────────────────────────────────────────── */}
      {balances.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-5">
            <CalendarDays size={16} className="text-violet-600" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Leave Days Breakdown</h2>
            <span className="ml-auto text-[11px] text-slate-400">{currentYear}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.map((b, idx) => {
              const color = typeColors[idx % typeColors.length];
              const entitlement = b.entitlement ?? 0;
              const used = b.used ?? 0;
              const remaining = b.available ?? (entitlement - used);
              const pctUsed = entitlement > 0 ? Math.min(100, Math.round((used / entitlement) * 100)) : 0;
              const label = b.name || b.code || `Type ${idx + 1}`;

              return (
                <div key={b.id || b.code || idx} className={`rounded-xl p-4 border ${color.light} border-transparent`}>
                  {/* Type header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${color.bg}`} />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize">{label}</span>
                    </div>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${color.light} ${color.text}`}>
                      {entitlement}d total
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pctUsed}%`, backgroundColor: color.bar }}
                    />
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium mb-0.5">Entitlement</div>
                      <div className="text-sm font-black text-slate-700 dark:text-slate-200">{entitlement}d</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium mb-0.5">Used</div>
                      <div className={`text-sm font-black ${color.text}`}>{used}d</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium mb-0.5">Remaining</div>
                      <div className={`text-sm font-black ${remaining < 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
                        {remaining}d
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
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

      {/* ── Request history filter + table ──────────────────────────────────── */}
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
