import { useState } from 'react';
import { Check, X, Search, FileSpreadsheet, ListTodo } from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { leaveRequestsList, employeesList, leaveTypesList, leaveBalancesList } from '../data/mockData';

export default function ApprovalDashboard() {
  const [activeTab, setActiveTab] = useState<'requests' | 'directs'>('requests');
  const [requests, setRequests] = useState(leaveRequestsList);
  const [searchQuery, setSearchQuery] = useState('');

  // direct reports of Gabriel (acting manager here)
  const directReports = employeesList.filter((emp) => emp.managerId === 1);

  // Filter pending requests for direct reports
  const pendingRequests = requests.filter(
    (req) => req.status === 'pending' && directReports.some((rep) => rep.id === req.employeeId)
  );

  function handleAction(id: number, status: 'approved' | 'declined') {
    setRequests(
      requests.map((req) => (req.id === id ? { ...req, status } : req))
    );
  }

  // Filter direct reports table
  const filteredDirects = directReports.filter((rep) =>
    rep.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Approval Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your direct reports' leave requests and balances contextually
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'requests' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ListTodo size={14} />
            Requests ({pendingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('directs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'directs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet size={14} />
            Directs Balance
          </button>
        </div>
      </div>

      {activeTab === 'requests' ? (
        /* ── Pending Requests Queue ── */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {pendingRequests.length === 0 ? (
            <EmptyState
              title="You do not have any requests pending at the moment"
              message="Good job! All direct reports requests have been processed."
              icon="🎉"
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingRequests.map((req) => {
                const emp = employeesList.find((e) => e.id === req.employeeId);
                const type = leaveTypesList.find((t) => t.key === req.leaveType);
                return (
                  <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50">
                    <div className="flex items-start gap-3">
                      <Avatar name={emp?.name || 'Unknown'} size="md" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{emp?.name}</h4>
                        <p className="text-xs text-slate-400">{emp?.department} · {emp?.unit}</p>
                        <p className="text-xs text-slate-500 mt-2 italic">"{req.note || 'No reason provided'}"</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                      {/* Leave details */}
                      <div className="text-left">
                        <Badge label={type?.label || 'Leave'} variant="leave" />
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                          {new Date(req.startDate).toLocaleDateString('en-US')} to {new Date(req.endDate).toLocaleDateString('en-US')}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Total Duration: {req.totalDays} days</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAction(req.id, 'approved')}
                          className="flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          onClick={() => handleAction(req.id, 'declined')}
                          className="flex items-center gap-1 bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                        >
                          <X size={14} /> Decline
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Directs Balances Overview Table ── */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-5">
          <div className="relative max-w-sm mb-5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search direct report..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Name</th>
                  {leaveTypesList.map((type) => (
                    <th key={type.key} className="py-3 px-4 text-center whitespace-nowrap">
                      {type.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredDirects.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">#00{rep.id}</td>
                    <td className="py-3 px-4 font-bold text-slate-700">{rep.name}</td>
                    {leaveTypesList.map((type) => {
                      const balance = leaveBalancesList.find((b) => b.employeeId === 1 && b.leaveType === type.key); // Simulate for directs
                      const amount = balance ? balance.amount : 0;
                      return (
                        <td key={type.key} className="py-3 px-4 text-center font-semibold text-slate-600">
                          {amount}d
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
