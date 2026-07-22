import { useState, useEffect } from 'react';
import { Check, X, Search, FileSpreadsheet, ListTodo, RefreshCw } from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { apiFetch } from '../services/apiClient';
import { getEmployees, type BackendEmployee } from '../services/employeesApi';
import { getLeaveTypes, type LeaveTypeItem } from '../services/leaveTypesApi';
import { getBalances, type BackendLeaveBalance } from '../services/balancesApi';

interface MyApprovalItem {
  stepInstanceId: string;
  requestId: string;
  stepOrder: number;
  approverType: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  reason: string;
  submittedAt: string;
}

export default function ApprovalDashboard() {
  const [activeTab, setActiveTab] = useState<'requests' | 'directs'>('requests');
  const [pendingApprovals, setPendingApprovals] = useState<MyApprovalItem[]>([]);
  const [directReports, setDirectReports] = useState<BackendEmployee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [balances, setBalances] = useState<BackendLeaveBalance[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  const loadData = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [approvalsData, employeesData, typesData, balancesData] = await Promise.all([
        apiFetch<MyApprovalItem[]>('/leave-requests/my-approvals', { signal }),
        getEmployees({ status: 'ACTIVE', limit: 1000 }, signal),
        getLeaveTypes(signal),
        getBalances({ limit: 1000 }, signal),
      ]);

      setPendingApprovals(approvalsData || []);
      setLeaveTypes(typesData || []);
      setBalances(balancesData || []);

      // Filter direct reports where managerId matches the current user
      if (currentUser?.id) {
        const directs = (employeesData || []).filter((emp) => emp.managerId === currentUser.id);
        setDirectReports(directs);
      }
    } catch (err) {
      console.error('Failed to load approval dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, []);

  async function handleAction(requestId: string, status: 'approved' | 'rejected') {
    let comment = '';
    if (status === 'approved') {
      const input = prompt('Enter an optional approval comment:');
      if (input === null) return; // User cancelled prompt
      comment = input.trim();
    } else {
      const input = prompt('Rejection reason is required. Please specify a reason:');
      if (input === null) return;
      if (input.trim() === '') {
        alert('Rejection reason cannot be empty.');
        return;
      }
      comment = input.trim();
    }

    setActionLoading(requestId);
    try {
      if (status === 'approved') {
        await apiFetch<any>(`/leave-requests/${requestId}/approve`, {
          method: 'PUT',
          body: JSON.stringify({ comment }),
        });
      } else {
        await apiFetch<any>(`/leave-requests/${requestId}/reject`, {
          method: 'PUT',
          body: JSON.stringify({ reason: comment }),
        });
      }
      // Reload queue
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setActionLoading(null);
    }
  }

  // Filter direct reports table
  const filteredDirects = directReports.filter((rep) =>
    rep.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm flex justify-center items-center gap-2">
        <RefreshCw size={16} className="animate-spin text-blue-600" /> Loading approval dashboard...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Approval Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your direct reports' leave requests and balances contextually
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'requests' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ListTodo size={14} />
            Requests ({pendingApprovals.length})
          </button>
          <button
            onClick={() => setActiveTab('directs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'directs' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet size={14} />
            Directs Balance
          </button>
        </div>
      </div>

      {activeTab === 'requests' ? (
        /* ── Pending Requests Queue ── */
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          {pendingApprovals.length === 0 ? (
            <EmptyState
              title="You do not have any requests pending at the moment"
              message="Good job! All direct reports requests have been processed."
              icon="🎉"
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {pendingApprovals.map((req) => {
                const subDate = new Date(req.submittedAt).toLocaleDateString('en-US');
                return (
                  <div key={req.requestId} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                    <div className="flex items-start gap-3">
                      <Avatar name={req.employeeName || 'Unknown'} size="md" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">{req.employeeName}</h4>
                        <p className="text-xs text-slate-400">Step {req.stepOrder} Approval ({req.approverType})</p>
                        <p className="text-xs text-slate-500 mt-2 italic">"{req.reason || 'No reason provided'}"</p>
                        <p className="text-[10px] text-slate-400 mt-1">Submitted: {subDate}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                      {/* Leave details */}
                      <div className="text-left">
                        <Badge label={req.leaveTypeName || 'Leave'} variant="leave" />
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                          {new Date(req.startDate).toLocaleDateString('en-US')} to {new Date(req.endDate).toLocaleDateString('en-US')}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Total Duration: {req.durationDays} days</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          disabled={actionLoading !== null}
                          onClick={() => handleAction(req.requestId, 'approved')}
                          className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          disabled={actionLoading !== null}
                          onClick={() => handleAction(req.requestId, 'rejected')}
                          className="flex items-center gap-1 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden p-5">
          <div className="relative max-w-sm mb-5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search direct report..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-400 uppercase">
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Name</th>
                  {leaveTypes.map((type) => (
                    <th key={type.id} className="py-3 px-4 text-center whitespace-nowrap">
                      {type.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {filteredDirects.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">#00{rep.fullName.slice(0, 3).toUpperCase()}</td>
                    <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-200">{rep.fullName}</td>
                    {leaveTypes.map((type) => {
                      const balance = balances.find((b) => b.employeeId === rep.id && b.leaveTypeId === type.id);
                      const amount = balance ? (balance.availableBalance !== undefined ? balance.availableBalance : balance.usedYtd) : 0;
                      return (
                        <td key={type.id} className="py-3 px-4 text-center font-semibold text-slate-600 dark:text-slate-400">
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
