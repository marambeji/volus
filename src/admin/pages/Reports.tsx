import { useState } from 'react';
import { BarChart3, Download, PieChart, TrendingUp, Globe, Building2, Eye } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';
import type { LeaveTypeKey } from '../../types';

type ReportType = 'balances' | 'requests' | 'types' | 'countries' | 'departments';

export default function Reports() {
  const { state } = useAdmin();
  const [activeReport, setActiveReport] = useState<ReportType>('balances');
  const [filterYear, setFilterYear] = useState('2026');

  // 1. Leave Balances Report Data
  const getBalancesReport = () => {
    return state.employees.map(emp => {
      const annual = state.leaveBalances.find(b => b.employeeId === emp.id && b.leaveType === 'annual')?.amount ?? 0;
      const sick = state.leaveBalances.find(b => b.employeeId === emp.id && b.leaveType === 'sick')?.amount ?? 0;
      const unpaid = state.leaveBalances.find(b => b.employeeId === emp.id && b.leaveType === 'unpaid')?.amount ?? 0;
      const totalAvailable = state.leaveBalances.filter(b => b.employeeId === emp.id).reduce((sum, b) => sum + b.amount, 0);
      return {
        id: emp.id,
        name: emp.name,
        department: emp.department,
        country: emp.country,
        annual,
        sick,
        unpaid,
        total: totalAvailable
      };
    });
  };

  // 2. Requests Report Data
  const getRequestsReport = () => {
    return state.leaveRequests
      .filter(r => r.startDate.startsWith(filterYear))
      .map(r => {
        const emp = state.employees.find(e => e.id === r.employeeId);
        return {
          id: r.id,
          employeeName: emp?.name ?? 'Unknown',
          leaveType: r.leaveType,
          startDate: r.startDate,
          endDate: r.endDate,
          totalDays: r.totalDays,
          status: r.status,
          submittedDate: r.submittedDate
        };
      });
  };

  // 3. Leave Types Summary
  const getTypesReport = () => {
    const types: LeaveTypeKey[] = ['annual','sick','bereavement','wedding','paternity','maternity','public_holiday','compensation','unpaid','overtime'];
    return types.map(t => {
      const typeReqs = state.leaveRequests.filter(r => r.leaveType === t && r.startDate.startsWith(filterYear));
      const totalRequests = typeReqs.length;
      const totalDays = typeReqs.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.totalDays, 0);
      const activeUsers = new Set(typeReqs.map(r => r.employeeId)).size;
      return {
        type: t,
        totalRequests,
        totalDays,
        activeUsers
      };
    });
  };

  // 4. Country Breakdown
  const getCountryReport = () => {
    const uniqueCountries = [...new Set(state.employees.map(e => e.country))];
    return uniqueCountries.map(c => {
      const countryEmployees = state.employees.filter(e => e.country === c);
      const employeesCount = countryEmployees.length;
      const holidaysCount = state.holidays.filter(h => h.country === c && h.date.startsWith(filterYear)).length;
      const policyName = state.policies.find(p => p.country === c)?.policyName ?? 'None';
      return {
        country: c,
        employeesCount,
        holidaysCount,
        policyName
      };
    });
  };

  // 5. Department Breakdown
  const getDepartmentReport = () => {
    return state.departments.map(dept => {
      const deptEmployees = state.employees.filter(e => e.department === dept.name);
      const memberCount = deptEmployees.length;
      const headName = state.employees.find(e => e.id === dept.headId)?.name ?? '—';
      const approvedCount = state.leaveRequests.filter(r => {
        const emp = state.employees.find(e => e.id === r.employeeId);
        return emp?.department === dept.name && r.status === 'approved' && r.startDate.startsWith(filterYear);
      }).reduce((sum, r) => sum + r.totalDays, 0);

      return {
        name: dept.name,
        headName,
        teamsCount: dept.teams.length,
        memberCount,
        approvedDays: approvedCount
      };
    });
  };

  // Export CSV Handler
  function handleExport() {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `report_${activeReport}.csv`;

    if (activeReport === 'balances') {
      headers = ['Employee ID', 'Name', 'Department', 'Country', 'Annual Balance', 'Sick Balance', 'Unpaid Balance', 'Total Available'];
      rows = getBalancesReport().map(b => [
        String(b.id), b.name, b.department, b.country, String(b.annual), String(b.sick), String(b.unpaid), String(b.total)
      ]);
    } else if (activeReport === 'requests') {
      headers = ['Request ID', 'Employee Name', 'Leave Type', 'Start Date', 'End Date', 'Total Days', 'Status', 'Submitted Date'];
      rows = getRequestsReport().map(r => [
        String(r.id), r.employeeName, r.leaveType, r.startDate, r.endDate, String(r.totalDays), r.status, r.submittedDate
      ]);
      filename = `report_requests_${filterYear}.csv`;
    } else if (activeReport === 'types') {
      headers = ['Leave Type', 'Total Requests', 'Total Approved Days', 'Active Users'];
      rows = getTypesReport().map(t => [
        t.type, String(t.totalRequests), String(t.totalDays), String(t.activeUsers)
      ]);
      filename = `report_leave_types_${filterYear}.csv`;
    } else if (activeReport === 'countries') {
      headers = ['Country', 'Employees Count', 'Holidays Count', 'Assigned Policy'];
      rows = getCountryReport().map(c => [
        c.country, String(c.employeesCount), String(c.holidaysCount), c.policyName
      ]);
    } else if (activeReport === 'departments') {
      headers = ['Department', 'Department Head', 'Teams Count', 'Members Count', 'Total Approved Days'];
      rows = getDepartmentReport().map(d => [
        d.name, d.headName, String(d.teamsCount), String(d.memberCount), String(d.approvedDays)
      ]);
      filename = `report_departments_${filterYear}.csv`;
    }

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
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

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Reports Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Export, preview, and analyze leave analytics data</p>
        </div>
        <div className="flex items-center gap-3">
          {activeReport !== 'balances' && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl text-xs">
              <span className="text-slate-400 font-bold">Year:</span>
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 focus:outline-none">
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>
          )}
          <button onClick={handleExport} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer shadow-sm">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: 'balances', label: 'Leave Balances', icon: PieChart, color: 'border-violet-500 text-violet-600 dark:text-violet-400' },
          { key: 'requests', label: 'Leave Requests', icon: TrendingUp, color: 'border-blue-500 text-blue-600 dark:text-blue-400' },
          { key: 'types', label: 'Leave Types', icon: BarChart3, color: 'border-emerald-500 text-emerald-600 dark:text-emerald-400' },
          { key: 'countries', label: 'Countries', icon: Globe, color: 'border-orange-500 text-orange-600 dark:text-orange-400' },
          { key: 'departments', label: 'Departments', icon: Building2, color: 'border-pink-500 text-pink-600 dark:text-pink-400' }
        ].map(tab => {
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

      {/* Preview Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 text-slate-500">
            <Eye size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Report Preview ({activeReport})</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeReport === 'balances' && (() => {
            const data = getBalancesReport();
            return (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Country</th>
                    <th className="py-3 px-4 text-center">Annual</th>
                    <th className="py-3 px-4 text-center">Sick</th>
                    <th className="py-3 px-4 text-center">Unpaid</th>
                    <th className="py-3 px-4 text-center">Total Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-xs">
                  {data.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{b.name}</td>
                      <td className="py-3.5 px-4 text-slate-500">{b.department}</td>
                      <td className="py-3.5 px-4 text-slate-500">{b.country}</td>
                      <td className="py-3.5 px-4 text-center font-semibold">{b.annual}d</td>
                      <td className="py-3.5 px-4 text-center font-semibold">{b.sick}d</td>
                      <td className="py-3.5 px-4 text-center font-semibold">{b.unpaid}d</td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-violet-600 dark:text-violet-400">{b.total}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}

          {activeReport === 'requests' && (() => {
            const data = getRequestsReport();
            return (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    <th className="py-3 px-4">Request ID</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4 text-center">Total Days</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Submitted Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-xs">
                  {data.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-slate-400">No requests found for {filterYear}</td></tr>
                  )}
                  {data.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="py-3.5 px-4 text-slate-500">#{r.id}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{r.employeeName}</td>
                      <td className="py-3.5 px-4 capitalize text-slate-600 dark:text-slate-300">{r.leaveType.replace('_', ' ')}</td>
                      <td className="py-3.5 px-4 text-slate-500">{r.startDate} → {r.endDate}</td>
                      <td className="py-3.5 px-4 text-center font-bold">{r.totalDays}d</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : r.status === 'declined' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{r.submittedDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}

          {activeReport === 'types' && (() => {
            const data = getTypesReport();
            return (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4 text-center">Total Requests ({filterYear})</th>
                    <th className="py-3 px-4 text-center">Total Approved Days ({filterYear})</th>
                    <th className="py-3 px-4 text-center">Active Employees Utilizing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-xs">
                  {data.map(t => (
                    <tr key={t.type} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="py-3.5 px-4 font-bold capitalize text-slate-800 dark:text-white">{t.type.replace('_',' ')}</td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600 dark:text-slate-300">{t.totalRequests}</td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-slate-800 dark:text-white">{t.totalDays} days</td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-500">{t.activeUsers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}

          {activeReport === 'countries' && (() => {
            const data = getCountryReport();
            return (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    <th className="py-3 px-4">Country</th>
                    <th className="py-3 px-4 text-center">Number of Employees</th>
                    <th className="py-3 px-4 text-center">Holidays Count ({filterYear})</th>
                    <th className="py-3 px-4">Assigned Standard Policy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-xs">
                  {data.map(c => (
                    <tr key={c.country} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{c.country}</td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600 dark:text-slate-300">{c.employeesCount}</td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600 dark:text-slate-300">{c.holidaysCount} holidays</td>
                      <td className="py-3.5 px-4 text-slate-500 font-semibold">{c.policyName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}

          {activeReport === 'departments' && (() => {
            const data = getDepartmentReport();
            return (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    <th className="py-3 px-4">Department Name</th>
                    <th className="py-3 px-4">Department Head</th>
                    <th className="py-3 px-4 text-center">Teams Count</th>
                    <th className="py-3 px-4 text-center">Employees Count</th>
                    <th className="py-3 px-4 text-center">Approved Approved Days ({filterYear})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-xs">
                  {data.map(d => (
                    <tr key={d.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{d.name}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">{d.headName}</td>
                      <td className="py-3.5 px-4 text-center text-slate-500">{d.teamsCount} teams</td>
                      <td className="py-3.5 px-4 text-center text-slate-500">{d.memberCount} members</td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-pink-600 dark:text-pink-400">{d.approvedDays} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
