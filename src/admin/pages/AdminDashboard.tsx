import { Users, CalendarCheck, Clock, CheckCircle2, Globe, Building2, Activity } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';
import StatCard from '../components/ui/StatCard';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';

const COLORS = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#14B8A6','#F97316','#6B7280','#06B6D4'];

export default function AdminDashboard() {
  const { state } = useAdmin();

  const totalEmployees = state.employees.length;
  const onLeaveToday  = state.employees.filter(e => e.status === 'on_leave').length;
  const pendingReqs   = state.leaveRequests.filter(r => r.status === 'pending').length;
  const approvedReqs  = state.leaveRequests.filter(r => r.status === 'approved').length;
  const activeEmp     = state.employees.filter(e => e.status === 'active').length;

  // By department
  const deptData = state.departments.map(d => ({
    name: d.name.substring(0, 7),
    employees: state.employees.filter(e => e.department === d.name).length,
  })).filter(d => d.employees > 0);

  // By country
  const countries = [...new Set(state.employees.map(e => e.country))];
  const countryData = countries.map(c => ({
    name: c.substring(0, 8),
    value: state.employees.filter(e => e.country === c).length,
  }));

  // Leave requests trend (mock monthly)
  const trendData = [
    { month: 'Feb', requests: 4, approved: 3 },
    { month: 'Mar', requests: 7, approved: 6 },
    { month: 'Apr', requests: 5, approved: 4 },
    { month: 'May', requests: 9, approved: 7 },
    { month: 'Jun', requests: 6, approved: 5 },
    { month: 'Jul', requests: state.leaveRequests.length, approved: approvedReqs },
  ];

  // Leave types distribution
  const leaveTypeDist = ['annual','sick','compensation','maternity','paternity','bereavement'].map((t,i) => ({
    name: t.charAt(0).toUpperCase() + t.slice(1),
    value: state.leaveRequests.filter(r => r.leaveType === t).length,
    color: COLORS[i],
  })).filter(d => d.value > 0);

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">HR Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Welcome back — here's your company overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Total Employees"    value={totalEmployees} icon={<Users size={18}/>}         color="bg-violet-500" trend={5}  />
        <StatCard title="Active"             value={activeEmp}      icon={<CheckCircle2 size={18}/>}  color="bg-emerald-500" trend={2} />
        <StatCard title="On Leave Today"     value={onLeaveToday}   icon={<CalendarCheck size={18}/>} color="bg-blue-500"   trend={-1} />
        <StatCard title="Pending Requests"   value={pendingReqs}    icon={<Clock size={18}/>}         color="bg-amber-500"  />
        <StatCard title="Approved (All Time)" value={approvedReqs}  icon={<Activity size={18}/>}      color="bg-indigo-500" trend={12} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave Trend */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Leave Requests Trend</h3>
          <p className="text-xs text-slate-400 mb-4">Monthly requests vs approved — 2026</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gApp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
              <Area type="monotone" dataKey="requests" stroke="#8B5CF6" strokeWidth={2} fill="url(#gReq)" name="Submitted" />
              <Area type="monotone" dataKey="approved"  stroke="#10B981" strokeWidth={2} fill="url(#gApp)" name="Approved" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Leave Types Pie */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">By Leave Type</h3>
          <p className="text-xs text-slate-400 mb-4">Distribution of all requests</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={leaveTypeDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {leaveTypeDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5 mt-2">
            {leaveTypeDist.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-slate-600 dark:text-slate-400">{d.name}</span></div>
                <span className="font-bold text-slate-700 dark:text-slate-300">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Department Bar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2"><Building2 size={16} className="text-violet-500"/>By Department</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deptData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
              <Bar dataKey="employees" fill="#8B5CF6" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By Country */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><Globe size={16} className="text-blue-500"/>By Country</h3>
          <div className="flex flex-col gap-2">
            {countryData.map(c => (
              <div key={c.name} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 w-20 truncate">{c.name}</span>
                <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(c.value / totalEmployees) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-4">{c.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><Activity size={16} className="text-emerald-500"/>Recent Activity</h3>
          <div className="flex flex-col gap-3 max-h-52 overflow-y-auto">
            {state.auditLog.slice(0, 8).map(log => (
              <div key={log.id} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-snug">{log.description}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(log.timestamp).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Requests Quick Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><Clock size={16} className="text-amber-500"/>Pending Requests ({pendingReqs})</h3>
        {pendingReqs === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">🎉 All requests have been processed!</p>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {state.leaveRequests.filter(r => r.status === 'pending').slice(0, 5).map(req => {
              const emp = state.employees.find(e => e.id === req.employeeId);
              return (
                <div key={req.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-gradient-to-br from-violet-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-black">
                      {emp?.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{emp?.name}</p>
                      <p className="text-[10px] text-slate-400">{req.leaveType} · {req.totalDays} days · {new Date(req.startDate).toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                  <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-bold">Pending</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
