import { useState, useEffect } from 'react';
import { Search, Grid, GitBranch, Mail, Calendar, MapPin, ShieldAlert, Building2, Users, ChevronRight } from 'lucide-react';
import { getDirectory } from '../services/employeesApi';

import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

const departmentsList = ['All', 'Engineering', 'Marketing', 'HR', 'Finance', 'Sales', 'Operations', 'Legal'];

export default function People() {
  const [viewMode, setViewMode] = useState<'card' | 'chart'>('card');
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('All');
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Org Chart state
  const [selectedChartEmployeeId, setSelectedChartEmployeeId] = useState<string>(''); 

  useEffect(() => {
    async function loadDirectory() {
      setLoading(true);
      setError(false);
      try {
        const res = await getDirectory({ q: query, department: dept, limit: 100 });
        setEmployees(res.items || []);
        setTotal(res.total || 0);
        if (res.items && res.items.length > 0 && !selectedChartEmployeeId) {
          setSelectedChartEmployeeId(res.items[0].id);
        }
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadDirectory();
  }, [query, dept]);

  const selectedChartEmp = employees.find((e) => e.id === selectedChartEmployeeId) || employees[0];
  const chartManager = employees.find((e) => e.id === selectedChartEmp?.manager?.id);
  const chartDirects = employees.filter((e) => e.manager?.id === selectedChartEmp?.id);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">People Directory</h1>
          <p className="text-slate-400 text-sm mt-1">
            {total} employee{total === 1 ? '' : 's'} inside Novelus
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start">
          <button
            onClick={() => setViewMode('card')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'card' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Grid size={14} />
            Card View
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <GitBranch size={14} />
            Org Chart
          </button>
        </div>
      </div>

      {viewMode === 'card' ? (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              />
            </div>
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              {departmentsList.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Directory Cards */}
          {loading ? (
            <div className="flex justify-center p-12 text-slate-400">Loading...</div>
          ) : error ? (
            <EmptyState title="Failed to load directory" message="Please try again." icon="⚠️" />
          ) : employees.length === 0 ? (
            <EmptyState title="No employees found" message="Try a different search query." icon="👥" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {employees.map((emp) => {
                const manager = emp.manager;
                const formattedDate = new Date(emp.startDate).toLocaleDateString('en-GB', {
                  day: '2-digit', month: '2-digit', year: 'numeric'
                });
                return (
                  <div
                    key={emp.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                  >
                    {/* Top Section: Avatar + Info + Chevron */}
                    <div className="flex items-start gap-4 p-5 pb-4">
                      {/* Large circular avatar */}
                      <div className="flex-shrink-0">
                        <Avatar name={emp.displayName} size="lg" />
                      </div>

                      {/* Name / Email / Role */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-slate-800 font-bold text-base leading-tight">{emp.displayName}</h3>
                        <p className="text-slate-500 text-xs mt-0.5 truncate">{emp.workEmail}</p>
                        <p className="text-slate-600 text-sm mt-1 font-medium">{emp.jobTitle ?? emp.department.name}</p>
                      </div>

                      {/* Circular chevron button */}
                      <button
                        onClick={() => {
                          setSelectedChartEmployeeId(emp.id);
                          setViewMode('chart');
                        }}
                        className="flex-shrink-0 w-9 h-9 rounded-full border-2 border-blue-500 flex items-center justify-center text-blue-500 hover:bg-blue-500 hover:text-white transition-all duration-200 mt-0.5"
                        title="View in Org Chart"
                      >
                        <ChevronRight size={16} strokeWidth={2.5} />
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="mx-5 border-t border-slate-100" />

                    {/* Bottom Section: 2-column metadata grid */}
                    <div className="p-5 pt-4 grid grid-cols-2 gap-x-6 gap-y-3.5">
                      {/* Start Date */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-blue-400 mt-0.5">
                          <Calendar size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 font-medium leading-none mb-1">Start Date</p>
                          <p className="text-sm text-slate-700 font-semibold">{formattedDate}</p>
                        </div>
                      </div>

                      {/* Department */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-blue-400 mt-0.5">
                          <Building2 size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 font-medium leading-none mb-1">Department</p>
                          <p className="text-sm text-slate-700 font-semibold truncate">{emp.department?.name}</p>
                        </div>
                      </div>

                      {/* Country */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-blue-400 mt-0.5">
                          <MapPin size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 font-medium leading-none mb-1">Country</p>
                          <p className="text-sm text-slate-700 font-semibold">{emp.country?.name}</p>
                        </div>
                      </div>

                      {/* Unit */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-blue-400 mt-0.5">
                          <Users size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 font-medium leading-none mb-1">Team</p>
                          <p className="text-sm text-slate-700 font-semibold truncate">{emp.team?.name || '—'}</p>
                        </div>
                      </div>

                      {/* Manager — spans full width */}
                      {manager && (
                        <div className="flex items-start gap-2.5 col-span-2">
                          <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-blue-400 mt-0.5">
                            <Mail size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-slate-400 font-medium leading-none mb-1">Manager</p>
                            <p className="text-sm text-slate-700 font-semibold">{manager.displayName}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Org Chart Interactive View */
        <div className="max-w-2xl mx-auto flex flex-col items-center py-8">
          {/* Search Dropdown for Org Chart */}
          <div className="w-full max-w-sm mb-12">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider text-center mb-2">
              Select Employee to View Chart
            </label>
            <select
              value={selectedChartEmployeeId}
              onChange={(e) => setSelectedChartEmployeeId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.displayName} ({emp.department?.name})</option>
              ))}
            </select>
          </div>

          {/* ── Visual Hierarchy Nodes ── */}
          <div className="w-full flex flex-col items-center gap-8 relative">
            {/* 1. Manager Node */}
            {chartManager ? (
              <div className="flex flex-col items-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Manager</p>
                <div
                  onClick={() => setSelectedChartEmployeeId(chartManager.id)}
                  className="bg-white border border-slate-200 shadow-sm rounded-xl px-5 py-3 flex items-center gap-3 hover:border-blue-400 cursor-pointer transition-colors"
                >
                  <Avatar name={chartManager.displayName} size="sm" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">{chartManager.displayName}</h4>
                    <p className="text-[10px] text-slate-400">{chartManager.department?.name}</p>
                  </div>
                </div>
                {/* Connector Line */}
                <div className="w-0.5 h-8 bg-slate-200 mt-2"></div>
              </div>
            ) : (
              <div className="h-[68px] flex items-center text-[10px] font-medium text-slate-300">Top of reporting tree</div>
            )}

            {/* 2. Highlighted Selected Node */}
            {selectedChartEmp && (
              <div className="flex flex-col items-center bg-blue-50 border-2 border-blue-500 shadow-md rounded-2xl p-6 w-full max-w-sm text-center relative">
                <div className="absolute -top-3.5 bg-blue-600 text-white text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                  Selected
                </div>
                <div className="flex flex-col items-center gap-3">
                  <Avatar name={selectedChartEmp.displayName} size="lg" />
                  <div>
                    <h3 className="text-slate-800 font-extrabold text-base">{selectedChartEmp.displayName}</h3>
                    <p className="text-blue-600 font-semibold text-xs mt-0.5">{selectedChartEmp.department?.name} · {selectedChartEmp.team?.name}</p>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Badge label={selectedChartEmp.country?.name} variant="department" />
                  </div>
                </div>
              </div>
            )}

            {/* Connector Line to Directs */}
            <div className="w-0.5 h-8 bg-slate-200"></div>

            {/* 3. Direct Reports Node */}
            <div className="w-full flex flex-col items-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Direct Reports</p>
              {chartDirects.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl px-6 py-4 flex items-center gap-2 text-slate-400 text-xs font-medium">
                  <ShieldAlert size={14} />
                  Does not have any directs.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full">
                  {chartDirects.map((direct) => (
                    <div
                      key={direct.id}
                      onClick={() => setSelectedChartEmployeeId(direct.id)}
                      className="bg-white border border-slate-200 shadow-sm rounded-xl p-3.5 flex items-center gap-3 hover:border-blue-400 cursor-pointer transition-colors"
                    >
                      <Avatar name={direct.displayName} size="sm" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-700">{direct.displayName}</h4>
                        <p className="text-[10px] text-slate-400">{direct.department?.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
