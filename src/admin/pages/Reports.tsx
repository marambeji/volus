import { useState, useEffect } from 'react';
import { BarChart3, Download, PieChart, TrendingUp, Globe, Building2, Eye, AlertTriangle, RefreshCw } from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import ReportFilterBar from '../../components/reports/ReportFilterBar';
import RequestsTable from '../../components/reports/RequestsTable';
import BalancesTable from '../../components/reports/BalancesTable';
import OverlapsPanel from '../../components/reports/OverlapsPanel';
import { MonthlyUsageBarChart, BreakdownChart } from '../../components/reports/reportCharts';
import {
  getRequestsReport,
  getBalancesReport,
  getOverlapsReport,
  type ReportRequestRow,
  type ReportBalanceRow,
  type ReportOverlaps,
} from '../../services/reportsApi';
import { getEmployees, type BackendEmployee } from '../../services/employeesApi';
import { getLeaveTypes, type LeaveTypeItem } from '../../services/leaveTypesApi';
import { getCountries, type CountryItem } from '../../services/countriesApi';
import { CANONICAL_DEPARTMENT_NAMES } from '../data/adminMockData';

type ReportType = 'balances' | 'requests' | 'overlaps' | 'types' | 'countries' | 'departments';

// Summer months (June–August) used for seasonal breakdowns.
const SUMMER_MONTHS = ['Jun', 'Jul', 'Aug'];

export default function Reports() {
  const [activeReport, setActiveReport] = useState<ReportType>('balances');

  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [countries, setCountries] = useState<CountryItem[]>([]);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [department, setDepartment] = useState('');
  const [country, setCountry] = useState('');
  const [managerId, setManagerId] = useState('');
  const [status, setStatus] = useState('');

  const [requestsData, setRequestsData] = useState<ReportRequestRow[]>([]);
  const [balancesData, setBalancesData] = useState<ReportBalanceRow[]>([]);
  const [overlapsData, setOverlapsData] = useState<ReportOverlaps | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Filter/reference option lists loaded once.
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getEmployees({ limit: 1000 }, controller.signal),
      getLeaveTypes(controller.signal),
      getCountries(controller.signal),
    ])
      .then(([emps, types, ctys]) => {
        setEmployees(emps);
        setLeaveTypes(types);
        setCountries(ctys);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
      });
    return () => controller.abort();
  }, []);

  const filters = { dateFrom, dateTo, leaveTypeId, department, country, managerId, status };

  // Requests report backs Requests, Types, Countries and Departments tabs
  // (they're all breakdowns of the same underlying request list).
  useEffect(() => {
    if (!['requests', 'types', 'countries', 'departments'].includes(activeReport)) return;
    const controller = new AbortController();
    setLoading(true);
    setApiError(null);
    getRequestsReport(filters, controller.signal)
      .then(setRequestsData)
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setApiError(err instanceof Error ? err.message : 'Failed to load requests report');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, dateFrom, dateTo, leaveTypeId, department, country, managerId, status]);

  useEffect(() => {
    if (activeReport !== 'balances') return;
    const controller = new AbortController();
    setLoading(true);
    setApiError(null);
    getBalancesReport(filters, controller.signal)
      .then(setBalancesData)
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setApiError(err instanceof Error ? err.message : 'Failed to load balances report');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, dateFrom, dateTo, department, country, managerId]);

  useEffect(() => {
    if (activeReport !== 'overlaps') return;
    const controller = new AbortController();
    setLoading(true);
    setApiError(null);
    getOverlapsReport(filters, controller.signal)
      .then(setOverlapsData)
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setApiError(err instanceof Error ? err.message : 'Failed to load overlaps report');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, dateFrom, dateTo, leaveTypeId, department, country, managerId]);

  const searchedRequests = requestsData.filter((r) =>
    r.employeeName.toLowerCase().includes(search.toLowerCase())
  );
  const searchedBalances = balancesData.filter((b) =>
    b.employeeName.toLowerCase().includes(search.toLowerCase())
  );

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const requestsKpis = {
    total: requestsData.length,
    approved: requestsData.filter((r) => r.status === 'APPROVED').length,
    rejected: requestsData.filter((r) => r.status === 'REJECTED').length,
    pending: requestsData.filter((r) => r.status === 'PENDING').length,
  };
  const totalDaysUsed = balancesData.reduce(
    (sum, b) => sum + Object.values(b.balances).reduce((s, v) => s + v.used, 0),
    0
  );
  const utilizationSamples = balancesData.flatMap((b) =>
    Object.values(b.balances)
      .filter((v) => v.entitlement > 0)
      .map((v) => (v.used / v.entitlement) * 100)
  );
  const avgUtilization = utilizationSamples.length
    ? Math.round(utilizationSamples.reduce((s, v) => s + v, 0) / utilizationSamples.length)
    : 0;

  // ── Chart data ───────────────────────────────────────────────────────────
  const monthlyRequestCounts = (() => {
    const counts = new Map<string, number>();
    requestsData.forEach((r) => {
      const month = new Date(r.startDate).toLocaleString('en', { month: 'short' });
      counts.set(month, (counts.get(month) ?? 0) + 1);
    });
    const order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return order.filter((m) => counts.has(m)).map((m) => ({ month: m, value: counts.get(m)! }));
  })();

  const daysUsedByDepartment = (() => {
    const totals = new Map<string, number>();
    balancesData.forEach((b) => {
      const used = Object.values(b.balances).reduce((s, v) => s + v.used, 0);
      totals.set(b.department, (totals.get(b.department) ?? 0) + used);
    });
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
  })();

  const daysUsedByCountryFromRequests = (() => {
    const totals = new Map<string, number>();
    requestsData
      .filter((r) => r.status === 'APPROVED')
      .forEach((r) => {
        const key = r.country ?? 'Unknown';
        totals.set(key, (totals.get(key) ?? 0) + r.durationDays);
      });
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
  })();

  const daysUsedByDepartmentFromRequests = (() => {
    const totals = new Map<string, number>();
    requestsData
      .filter((r) => r.status === 'APPROVED')
      .forEach((r) => {
        const key = r.department ?? 'Unknown';
        totals.set(key, (totals.get(key) ?? 0) + r.durationDays);
      });
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
  })();

  // ── Derived table data (Types / Countries / Departments tabs) ──────────────
  const getTypesReport = () => {
    const byType = new Map<string, { totalRequests: number; totalDays: number; users: Set<string> }>();
    requestsData.forEach((r) => {
      const entry = byType.get(r.leaveTypeName) ?? { totalRequests: 0, totalDays: 0, users: new Set<string>() };
      entry.totalRequests += 1;
      if (r.status === 'APPROVED') entry.totalDays += r.durationDays;
      entry.users.add(r.employeeId);
      byType.set(r.leaveTypeName, entry);
    });
    return Array.from(byType.entries()).map(([type, v]) => ({
      type,
      totalRequests: v.totalRequests,
      totalDays: v.totalDays,
      activeUsers: v.users.size,
    }));
  };

  const getCountryReport = () => {
    const uniqueCountries = [...new Set(employees.map((e) => e.country))];
    return uniqueCountries.map((c) => ({
      country: c,
      employeesCount: employees.filter((e) => e.country === c).length,
      daysUsed: daysUsedByCountryFromRequests.find((d) => d.name === c)?.value ?? 0,
    }));
  };

  const getDepartmentReport = () => {
    return CANONICAL_DEPARTMENT_NAMES.filter((d) => employees.some((e) => e.department === d)).map((d) => ({
      name: d,
      memberCount: employees.filter((e) => e.department === d).length,
      daysUsed: daysUsedByDepartmentFromRequests.find((x) => x.name === d)?.value ?? 0,
    }));
  };

  // ── Export CSV ───────────────────────────────────────────────────────────
  function handleExport() {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `report_${activeReport}.csv`;

    if (activeReport === 'balances') {
      const typeKeys = Array.from(new Set(searchedBalances.flatMap((b) => Object.keys(b.balances)))).sort();
      headers = ['Employee', 'Department', 'Country', ...typeKeys, 'Total Available'];
      rows = searchedBalances.map((b) => [
        b.employeeName,
        b.department,
        b.country ?? '',
        ...typeKeys.map((k) => String(b.balances[k]?.available ?? '')),
        String(b.totalAvailable),
      ]);
    } else if (activeReport === 'requests') {
      headers = ['Employee', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Department', 'Country'];
      rows = searchedRequests.map((r) => [
        r.employeeName, r.leaveTypeName, r.startDate, r.endDate, String(r.durationDays), r.status, r.department ?? '', r.country ?? '',
      ]);
    } else if (activeReport === 'types') {
      headers = ['Leave Type', 'Total Requests', 'Total Approved Days', 'Active Users'];
      rows = getTypesReport().map((t) => [t.type, String(t.totalRequests), String(t.totalDays), String(t.activeUsers)]);
    } else if (activeReport === 'countries') {
      headers = ['Country', 'Employees Count', 'Approved Days Used'];
      rows = getCountryReport().map((c) => [c.country, String(c.employeesCount), String(c.daysUsed)]);
    } else if (activeReport === 'departments') {
      headers = ['Department', 'Members Count', 'Approved Days Used'];
      rows = getDepartmentReport().map((d) => [d.name, String(d.memberCount), String(d.daysUsed)]);
    } else if (activeReport === 'overlaps' && overlapsData) {
      headers = ['Date Range', 'Employees Involved'];
      rows = overlapsData.clusters.map((c) => [
        `${c.startDate} to ${c.endDate}`,
        c.requests.map((r) => r.employeeName).join('; '),
      ]);
    }

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const managers = employees.filter((e) => e.role === 'MANAGER');
  const departmentOptions = Array.from(new Set(employees.map((e) => e.department))).map((d) => ({ label: d, value: d }));
  const countryOptions = countries.map((c) => ({ label: c.name, value: c.name }));
  const leaveTypeOptions = leaveTypes.map((t) => ({ label: t.label, value: t.id }));
  const managerOptions = managers.map((m) => ({ label: m.fullName, value: m.id }));

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Reports Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Company-wide leave analytics, filterable and exportable</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer shadow-sm">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {apiError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl flex items-center justify-between">
          <span className="text-sm font-medium">{apiError}</span>
        </div>
      )}

      {/* Tabs list */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { key: 'balances', label: 'Leave Balances', icon: PieChart, color: 'border-violet-500 text-violet-600 dark:text-violet-400' },
          { key: 'requests', label: 'Leave Requests', icon: TrendingUp, color: 'border-blue-500 text-blue-600 dark:text-blue-400' },
          { key: 'overlaps', label: 'Overlaps', icon: AlertTriangle, color: 'border-red-500 text-red-600 dark:text-red-400' },
          { key: 'types', label: 'Leave Types', icon: BarChart3, color: 'border-emerald-500 text-emerald-600 dark:text-emerald-400' },
          { key: 'countries', label: 'Countries', icon: Globe, color: 'border-orange-500 text-orange-600 dark:text-orange-400' },
          { key: 'departments', label: 'Departments', icon: Building2, color: 'border-pink-500 text-pink-600 dark:text-pink-400' },
        ].map((tab) => {
          const selected = activeReport === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveReport(tab.key as ReportType)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${selected ? `${tab.color} bg-white dark:bg-slate-800 shadow-sm border-current` : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <ReportFilterBar
        search={['requests', 'balances'].includes(activeReport) ? search : undefined}
        onSearchChange={['requests', 'balances'].includes(activeReport) ? setSearch : undefined}
        searchPlaceholder="Search employee..."
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        leaveTypeOptions={leaveTypeOptions}
        leaveTypeId={leaveTypeId}
        onLeaveTypeChange={activeReport === 'overlaps' ? undefined : setLeaveTypeId}
        departmentOptions={departmentOptions}
        department={department}
        onDepartmentChange={setDepartment}
        countryOptions={countryOptions}
        country={country}
        onCountryChange={setCountry}
        managerOptions={managerOptions}
        managerId={managerId}
        onManagerChange={setManagerId}
        statusOptions={[
          { label: 'Pending', value: 'PENDING' },
          { label: 'Approved', value: 'APPROVED' },
          { label: 'Rejected', value: 'REJECTED' },
          { label: 'Cancelled', value: 'CANCELLED' },
        ]}
        status={activeReport === 'requests' ? status : undefined}
        onStatusChange={activeReport === 'requests' ? setStatus : undefined}
      />

      {loading && (
        <div className="py-10 text-center text-slate-400 text-sm flex justify-center items-center gap-2">
          <RefreshCw size={16} className="animate-spin text-violet-600" /> Loading report...
        </div>
      )}

      {!loading && (
        <>
          {/* KPIs */}
          {activeReport === 'requests' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Total Requests" value={requestsKpis.total} icon={<TrendingUp size={18} />} color="bg-violet-500" />
              <StatCard title="Approved" value={requestsKpis.approved} icon={<TrendingUp size={18} />} color="bg-emerald-500" />
              <StatCard title="Rejected" value={requestsKpis.rejected} icon={<TrendingUp size={18} />} color="bg-red-500" />
              <StatCard title="Pending" value={requestsKpis.pending} icon={<TrendingUp size={18} />} color="bg-amber-500" />
            </div>
          )}
          {activeReport === 'balances' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard title="Total Days Used" value={totalDaysUsed} icon={<PieChart size={18} />} color="bg-violet-500" />
              <StatCard title="Employees" value={balancesData.length} icon={<Building2 size={18} />} color="bg-blue-500" />
              <StatCard title="Avg. Utilization" value={`${avgUtilization}%`} icon={<TrendingUp size={18} />} color="bg-emerald-500" />
            </div>
          )}
          {activeReport === 'overlaps' && overlapsData && (
            <div className="grid grid-cols-2 gap-4">
              <StatCard title="Peak Concurrent Absences" value={overlapsData.peakConcurrent} icon={<AlertTriangle size={18} />} color="bg-red-500" />
              <StatCard title="Overlapping Days" value={overlapsData.totalOverlapDays} icon={<AlertTriangle size={18} />} color="bg-amber-500" />
            </div>
          )}

          {/* Charts */}
          {activeReport === 'requests' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Requests by Month</h3>
              <p className="text-xs text-slate-400 mb-4">Most-used periods — summer months highlighted</p>
              <MonthlyUsageBarChart data={monthlyRequestCounts} label="Requests" highlightMonths={SUMMER_MONTHS} />
            </div>
          )}
          {activeReport === 'balances' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Days Used by Department</h3>
              <BreakdownChart data={daysUsedByDepartment} label="Days used" />
            </div>
          )}
          {activeReport === 'countries' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Approved Days by Country</h3>
              <BreakdownChart data={daysUsedByCountryFromRequests} label="Days used" />
            </div>
          )}
          {activeReport === 'departments' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Approved Days by Department</h3>
              <BreakdownChart data={daysUsedByDepartmentFromRequests} label="Days used" />
            </div>
          )}

          {/* Preview / table section */}
          {activeReport === 'overlaps' ? (
            overlapsData && <OverlapsPanel data={overlapsData} />
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 text-slate-500">
                  <Eye size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Report Preview ({activeReport})</span>
                </div>
              </div>

              {activeReport === 'balances' && <BalancesTable rows={searchedBalances} />}
              {activeReport === 'requests' && <RequestsTable rows={searchedRequests} />}

              {activeReport === 'types' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        <th className="py-3 px-4">Leave Type</th>
                        <th className="py-3 px-4 text-center">Total Requests</th>
                        <th className="py-3 px-4 text-center">Total Approved Days</th>
                        <th className="py-3 px-4 text-center">Active Employees Utilizing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-xs">
                      {getTypesReport().map((t) => (
                        <tr key={t.type} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                          <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{t.type}</td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-600 dark:text-slate-300">{t.totalRequests}</td>
                          <td className="py-3.5 px-4 text-center font-extrabold text-slate-800 dark:text-white">{t.totalDays} days</td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-500">{t.activeUsers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeReport === 'countries' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        <th className="py-3 px-4">Country</th>
                        <th className="py-3 px-4 text-center">Employees</th>
                        <th className="py-3 px-4 text-center">Approved Days Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-xs">
                      {getCountryReport().map((c) => (
                        <tr key={c.country} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                          <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{c.country}</td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-600 dark:text-slate-300">{c.employeesCount}</td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-600 dark:text-slate-300">{c.daysUsed} days</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeReport === 'departments' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4 text-center">Employees</th>
                        <th className="py-3 px-4 text-center">Approved Days Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-xs">
                      {getDepartmentReport().map((d) => (
                        <tr key={d.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                          <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{d.name}</td>
                          <td className="py-3.5 px-4 text-center text-slate-500">{d.memberCount}</td>
                          <td className="py-3.5 px-4 text-center font-extrabold text-pink-600 dark:text-pink-400">{d.daysUsed} days</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
