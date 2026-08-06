import { useState, useEffect } from 'react';
import {
  CalendarDays,
  PieChart as PieIcon,
  Sun,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Users,
  Clock,
  CheckCircle2,
  Download,
  Printer,
} from 'lucide-react';
import StatCard from '../admin/components/ui/StatCard';
import ReportFilterBar from '../components/reports/ReportFilterBar';
import RequestsTable from '../components/reports/RequestsTable';
import BalancesTable from '../components/reports/BalancesTable';
import OverlapsPanel from '../components/reports/OverlapsPanel';
import { MonthlyUsageBarChart, UsagePieChart } from '../components/reports/reportCharts';
import { PdfReportDocument } from '../components/reports/PdfReportDocument';
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
    return JSON.parse(localStorage.getItem('currentUser') || '{"name":"Maram Manager","role":"employee"}');
  } catch {
    return { id: '', name: 'Maram Manager', role: 'employee' };
  }
}

function exportReportToCsv(
  tab: 'balances' | 'requests' | 'overlaps',
  balances: ReportBalanceRow[],
  requests: ReportRequestRow[],
  overlaps: ReportOverlaps | null
) {
  let rows: string[][] = [];
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `novelus_hr_leave_report_${tab}_${timestamp}.csv`;

  if (tab === 'balances') {
    const typeKeys = Array.from(new Set(balances.flatMap((r) => Object.keys(r.balances || {})))).sort();
    const headers = [
      'Employee Name',
      'Department',
      'Country',
      ...typeKeys.map((k) => k.replace(/_/g, ' ')),
      'Total Available (days)',
    ];
    rows.push(headers);

    balances.forEach((r) => {
      const row = [
        r.employeeName,
        r.department || 'N/A',
        r.country || 'N/A',
        ...typeKeys.map((k) => (r.balances[k] ? `${r.balances[k].available}` : '0')),
        `${r.totalAvailable}`,
      ];
      rows.push(row);
    });
  } else if (tab === 'requests') {
    const headers = [
      'Employee Name',
      'Leave Type',
      'Start Date',
      'End Date',
      'Duration (days)',
      'Status',
      'Department',
      'Country',
    ];
    rows.push(headers);

    requests.forEach((r) => {
      rows.push([
        r.employeeName,
        r.leaveTypeName,
        r.startDate?.slice(0, 10) || '',
        r.endDate?.slice(0, 10) || '',
        `${r.durationDays}`,
        r.status,
        r.department || 'N/A',
        r.country || 'N/A',
      ]);
    });
  } else if (tab === 'overlaps' && overlaps) {
    const headers = ['Period Start', 'Period End', 'Overlap Count', 'Employee Names'];
    rows.push(headers);
    overlaps.clusters.forEach((c) => {
      rows.push([
        c.startDate,
        c.endDate,
        `${c.requests.length}`,
        c.requests.map((r) => r.employeeName).join('; '),
      ]);
    });
  }

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((val) => `"${val}"`).join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


export default function Reports() {
  const user = currentUser();
  return user.role === 'manager' ? <ManagerReports /> : <EmployeeReports />;
}

// ── Manager Reports ─────────────────────────────────────────────────────────

function ManagerReports() {
  const user = currentUser();
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
      getBalancesReport(query, controller.signal).catch(() => []),
      getRequestsReport(query, controller.signal).catch(() => []),
      getOverlapsReport(query, controller.signal).catch(() => null),
    ])
      .then(([balances, requests, overlaps]) => {
        setBalancesData(Array.isArray(balances) ? balances : []);
        setRequestsData(Array.isArray(requests) ? requests : []);
        setOverlapsData(overlaps);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Failed to load team report data:', err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [dateFrom, dateTo, leaveTypeId]);


  const searchedRequests = requestsData.filter((r) =>
    r.employeeName.toLowerCase().includes(search.toLowerCase())
  );
  const searchedBalances = balancesData.filter((b) =>
    b.employeeName.toLowerCase().includes(search.toLowerCase())
  );

  const monthlyRequestCounts = (() => {
    const counts = new Map<string, number>();
    requestsData.forEach((r) => {
      const month = new Date(r.startDate).toLocaleString('en', { month: 'short' });
      counts.set(month, (counts.get(month) ?? 0) + 1);
    });
    const order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return order.filter((m) => counts.has(m)).map((m) => ({ month: m, value: counts.get(m)! }));
  })();

  const totalMembers = balancesData.length;
  const approvedCount = requestsData.filter((r) => r.status === 'APPROVED').length;
  const pendingCount = requestsData.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {/* ── Printable PDF Executive Document View (Visible ONLY when printing/saving PDF) ── */}
      <div className="hidden print:block">
        <PdfReportDocument
          balances={balancesData}
          requests={requestsData}
          overlaps={overlapsData}
          filters={{ dateFrom, dateTo, leaveTypeId }}
          leaveTypes={leaveTypes}
          generatorName={user.name || 'Manager RH'}
          generatorRole="Manager d'Équipe"
        />
      </div>

      {/* ── Web App Interactive View (Hidden when printing/saving PDF) ── */}
      <div className="flex flex-col gap-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Team Reports</h1>
            <p className="text-slate-400 text-sm mt-0.5">Leave balances, requests, and overlap analytics for your team</p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => exportReportToCsv(tab, searchedBalances, searchedRequests, overlapsData)}
              className="px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-violet-600 hover:bg-violet-700 text-white transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Download size={15} /> Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Printer size={15} /> Print / Save PDF
            </button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            title="Team Members"
            value={totalMembers}
            icon={<Users size={18} />}
            color="bg-violet-600"
          />
          <StatCard
            title="Approved Requests"
            value={approvedCount}
            icon={<CheckCircle2 size={18} />}
            color="bg-emerald-500"
          />
          <StatCard
            title="Pending Requests"
            value={pendingCount}
            icon={<Clock size={18} />}
            color="bg-amber-500"
          />
          <StatCard
            title="Overlaps Detected"
            value={overlapsData?.clusters?.length ?? 0}
            icon={<AlertTriangle size={18} />}
            color="bg-pink-500"
          />
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 gap-3 max-w-md bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl">
          {[
            { key: 'balances', label: 'Balances', icon: PieIcon },
            { key: 'requests', label: 'Requests', icon: TrendingUp },
            { key: 'overlaps', label: 'Overlaps', icon: AlertTriangle },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                tab === t.key
                  ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters Bar */}
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

        {/* Content Body */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm flex justify-center items-center gap-3">
            <RefreshCw size={20} className="animate-spin text-violet-600" />
            <span className="font-semibold">Loading report data...</span>
          </div>
        ) : tab === 'balances' ? (
          <BalancesTable rows={searchedBalances} />
        ) : tab === 'requests' ? (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/80 p-6 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-1">Requests by Month</h3>
              <p className="text-xs text-slate-400 mb-4">Distribution of submitted leave requests</p>
              <MonthlyUsageBarChart data={monthlyRequestCounts} label="Requests" highlightMonths={SUMMER_MONTHS} />
            </div>
            <RequestsTable rows={searchedRequests} />
          </div>
        ) : (
          overlapsData && <OverlapsPanel data={overlapsData} />
        )}
      </div>
    </div>
  );
}

// ── Employee Reports ────────────────────────────────────────────────────────


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
  const pctAnnualUsed =
    annualBalance && annualBalance.entitlement > 0
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
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">My Leave Report</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your personal leave usage and analytics</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Annual Leave Used" value={`${pctAnnualUsed}%`} icon={<PieIcon size={18} />} color="bg-violet-600" />
        <StatCard title="Days Used" value={totalDaysUsed} icon={<CalendarDays size={18} />} color="bg-blue-600" />
        <StatCard title="Taken in Summer" value={`${pctSummer}%`} icon={<Sun size={18} />} color="bg-amber-500" subtitle="June – August" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/80 p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-1">Usage by Leave Type</h3>
          <UsagePieChart data={usageByType} />
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/80 p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-1">Days Taken by Month</h3>
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
        <div className="py-20 text-center text-slate-400 text-sm flex justify-center items-center gap-3">
          <RefreshCw size={20} className="animate-spin text-violet-600" />
          <span className="font-semibold">Loading report...</span>
        </div>
      ) : (
        <RequestsTable rows={requests} />
      )}
    </div>
  );
}
