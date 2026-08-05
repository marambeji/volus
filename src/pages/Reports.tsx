import { useState, useEffect } from 'react';
import { CalendarDays, PieChart as PieIcon, Sun, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import StatCard from '../admin/components/ui/StatCard';
import ReportFilterBar from '../components/reports/ReportFilterBar';
import RequestsTable from '../components/reports/RequestsTable';
import BalancesTable from '../components/reports/BalancesTable';
import OverlapsPanel from '../components/reports/OverlapsPanel';
import { MonthlyUsageBarChart, UsagePieChart } from '../components/reports/reportCharts';
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
const SUMMER_MONTH_NUMS = [6, 7, 8]; // 1-indexed

function currentUser(): { id: string; role: 'admin' | 'manager' | 'employee' } {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{"role":"employee"}');
  } catch {
    return { id: '', role: 'employee' };
  }
}

export default function Reports() {
  const user = currentUser();
  return user.role === 'manager' ? <ManagerReports /> : <EmployeeReports />;
}

// ── Manager: team-scoped balances/requests/overlaps (backend auto-scopes to direct reports) ──

function ManagerReports() {
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
    const load =
      tab === 'balances'
        ? getBalancesReport(query, controller.signal).then(setBalancesData)
        : tab === 'requests'
        ? getRequestsReport(query, controller.signal).then(setRequestsData)
        : getOverlapsReport(query, controller.signal).then(setOverlapsData);
    load
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Failed to load team report:', err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [tab, dateFrom, dateTo, leaveTypeId]);

  const searchedRequests = requestsData.filter((r) => r.employeeName.toLowerCase().includes(search.toLowerCase()));
  const searchedBalances = balancesData.filter((b) => b.employeeName.toLowerCase().includes(search.toLowerCase()));

  const monthlyRequestCounts = (() => {
    const counts = new Map<string, number>();
    requestsData.forEach((r) => {
      const month = new Date(r.startDate).toLocaleString('en', { month: 'short' });
      counts.set(month, (counts.get(month) ?? 0) + 1);
    });
    const order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return order.filter((m) => counts.has(m)).map((m) => ({ month: m, value: counts.get(m)! }));
  })();

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Team Reports</h1>
        <p className="text-slate-400 text-sm mt-1">Leave analytics for your direct reports</p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-lg">
        {[
          { key: 'balances', label: 'Balances', icon: PieIcon },
          { key: 'requests', label: 'Requests', icon: TrendingUp },
          { key: 'overlaps', label: 'Overlaps', icon: AlertTriangle },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${tab === t.key ? 'border-violet-500 text-violet-600 dark:text-violet-400 bg-white dark:bg-slate-800 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <ReportFilterBar
        search={tab !== 'overlaps' ? search : undefined}
        onSearchChange={tab !== 'overlaps' ? setSearch : undefined}
        searchPlaceholder="Search team member..."
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        leaveTypeOptions={leaveTypes.map((t) => ({ label: t.label, value: t.id }))}
        leaveTypeId={leaveTypeId}
        onLeaveTypeChange={tab !== 'overlaps' ? setLeaveTypeId : undefined}
      />

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
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Requests by Month</h3>
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
      .catch((err) => {
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
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Failed to load my requests report:', err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [dateFrom, dateTo, leaveTypeId]);

  const annualBalance = balances.find((b) => b.code === 'annual');
  const pctAnnualUsed = annualBalance && annualBalance.entitlement > 0
    ? Math.round((annualBalance.used / annualBalance.entitlement) * 100)
    : 0;

  const approvedRequests = requests.filter((r) => r.status === 'APPROVED');
  const totalDaysUsed = approvedRequests.reduce((sum, r) => sum + r.durationDays, 0);
  const summerDays = approvedRequests
    .filter((r) => SUMMER_MONTH_NUMS.includes(new Date(r.startDate).getMonth() + 1))
    .reduce((sum, r) => sum + r.durationDays, 0);
  const pctSummer = totalDaysUsed > 0 ? Math.round((summerDays / totalDaysUsed) * 100) : 0;

  const usageByType = balances
    .filter((b) => b.used > 0)
    .map((b) => ({ name: b.name || b.code, value: b.used }));

  const monthlyDaysUsed = (() => {
    const totals = new Map<string, number>();
    approvedRequests.forEach((r) => {
      const month = new Date(r.startDate).toLocaleString('en', { month: 'short' });
      totals.set(month, (totals.get(month) ?? 0) + r.durationDays);
    });
    const order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return order.filter((m) => totals.has(m)).map((m) => ({ month: m, value: totals.get(m)! }));
  })();

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">My Leave Report</h1>
        <p className="text-slate-400 text-sm mt-1">Your personal leave usage for the year</p>
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
        leaveTypeOptions={leaveTypes.map((t) => ({ label: t.label, value: t.id }))}
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
