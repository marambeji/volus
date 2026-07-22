import { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, CalendarDays, ArrowRightLeft, History, RefreshCcw, XCircle } from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import { leaveBalancesList, leaveLedgerList, leaveRequestsList, leaveTypesList } from '../data/mockData';
import { apiFetch } from '../services/apiClient';

const myInfo = {
  id: 1,
  name: 'Gabriel Habre',
  role: 'Senior Software Engineer',
  department: 'Engineering',
  email: 'gabriel.habre@novelus.com',
  phone: '+961 3 123 456',
  location: 'Beirut, Lebanon',
  startDate: 'March 12, 2021',
};

export default function MyInfo() {
  const [selectedLeaveType, setSelectedLeaveType] = useState('annual');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [tableMode, setTableMode] = useState<'requests' | 'ledger'>('requests');
  const [requests, setRequests] = useState<any[]>(leaveRequestsList);
  const [balances, setBalances] = useState<any[]>(leaveBalancesList);
  const [ledger] = useState(leaveLedgerList);

  useEffect(() => {
    async function loadData() {
      try {
        const [realRequests, realBalancesData] = await Promise.all([
          apiFetch<any[]>('/leave-requests/my-requests').catch(() => null),
          apiFetch<any>('/employees/me/leave-balances').catch(() => null),
        ]);

        if (realRequests && realRequests.length > 0) {
          const mapped = realRequests.map((r) => ({
            id: r.id,
            leaveType: r.leaveType?.key || r.leaveType?.label || 'annual',
            leaveTypeId: r.leaveTypeId,
            leaveTypeName: r.leaveType?.label || r.leaveType?.key || 'Annual Leave',
            startDate: r.startDate,
            endDate: r.endDate,
            note: r.reason || '',
            submittedDate: r.createdAt || new Date().toISOString(),
            approverComments: r.approvalInstances?.map((ai: any) => ai.decisionNote).filter(Boolean).join('; ') || '',
            status: r.status ? r.status.toLowerCase() : 'pending',
            totalDays: r.durationDays,
          }));
          setRequests(mapped);
        }

        if (realBalancesData && realBalancesData.balances && realBalancesData.balances.length > 0) {
          setBalances(realBalancesData.balances);
        }
      } catch (err) {
        console.error('Failed to load real MyInfo data:', err);
      }
    }
    void loadData();
  }, []);

  function handleRecall(requestId: number) {
    setRequests(
      requests.map((r) => (r.id === requestId ? { ...r, status: 'pending' as const } : r))
    );
  }

  function handleCancel(requestId: number) {
    setRequests(
      requests.map((r) => (r.id === requestId ? { ...r, status: 'declined' as const } : r))
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {/* Page Title & Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center gap-4 text-center justify-center">
          <Avatar name={myInfo.name} size="lg" />
          <div>
            <h2 className="text-slate-800 font-extrabold text-lg">{myInfo.name}</h2>
            <p className="text-slate-400 text-xs mt-0.5">{myInfo.role}</p>
            <div className="mt-2.5">
              <Badge label={myInfo.department} variant="department" />
            </div>
          </div>
        </div>

        {/* Contact & Details Panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
              <Mail size={15} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Email</p>
              <p className="text-slate-700 text-sm font-semibold">{myInfo.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
              <Phone size={15} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Phone</p>
              <p className="text-slate-700 text-sm font-semibold">{myInfo.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
              <MapPin size={15} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Location</p>
              <p className="text-slate-700 text-sm font-semibold">{myInfo.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
              <CalendarDays size={15} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Start Date</p>
              <p className="text-slate-700 text-sm font-semibold">{myInfo.startDate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Time Off Section (Horizontal Balance cards) ── */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Leave Balances</h3>
        <div className="flex gap-4 overflow-x-auto pb-3">
          {balances.map((item) => {
            const key = item.code || item.leaveType || item.leaveTypeId || 'annual';
            const isUsageYtd = item.trackingMode === 'USAGE_YTD';
            const value = isUsageYtd ? (item.usageYtd ?? item.amount ?? 0) : (item.availableBalance ?? item.amount ?? 0);
            const label = item.name || item.label || key;
            const isSelected = selectedLeaveType === key || selectedLeaveType === item.leaveTypeId;

            return (
              <div
                key={key}
                onClick={() => setSelectedLeaveType(key)}
                className={`flex-shrink-0 w-36 p-4 rounded-xl border transition-all cursor-pointer ${isSelected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                    : 'bg-white border-slate-100 text-slate-700 hover:border-blue-200'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color || '#3B82F6' }} />
                  <span className={`text-[10px] font-bold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                    {isUsageYtd ? 'Used YTD' : 'Available'}
                  </span>
                </div>
                <p className="text-2xl font-extrabold">{value}d</p>
                <p className={`text-xs truncate font-medium mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                  {label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── History & Ledger Table Section ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-3.5 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            {/* Title */}
            <div className="flex items-center gap-2 mr-1">
              <History size={18} className="text-blue-600" />
              <span className="text-slate-800 font-bold text-base">History</span>
            </div>

            {/* Filter Leave Type */}
            <select
              value={selectedLeaveType}
              onChange={(e) => setSelectedLeaveType(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="all">All Leave Types</option>
              {balances.map((b) => {
                const val = b.code || b.leaveType || b.leaveTypeId;
                const lbl = b.name || b.label || val;
                return (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                );
              })}
            </select>

            {/* Filter Year */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>

          {/* Toggle Table Mode */}
          <div className="flex bg-slate-100 p-1 rounded-xl self-start md:self-auto">
            <button
              onClick={() => setTableMode('requests')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tableMode === 'requests' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ArrowRightLeft size={13} />
              Requests
            </button>
            <button
              onClick={() => setTableMode('ledger')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tableMode === 'ledger' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <History size={13} />
              Balance History
            </button>
          </div>
        </div>

        {/* Table Render */}
        {tableMode === 'requests' ? (() => {
          const filteredRequests = requests.filter((r) => {
            if (!selectedLeaveType || selectedLeaveType === 'all') return true;
            const s = selectedLeaveType.toLowerCase();
            const rType = (r.leaveType || '').toLowerCase();
            const rTypeId = (r.leaveTypeId || '').toLowerCase();
            const rLabel = (r.leaveTypeName || '').toLowerCase();
            return rType === s || rTypeId === s || rLabel === s;
          });
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                    <th className="py-3 px-4 text-center">Date</th>
                    <th className="py-3 px-4 text-center">Leave Type</th>
                    <th className="py-3 px-4 text-center">Note</th>
                    <th className="py-3 px-4 text-center">Submitted</th>
                    <th className="py-3 px-4 text-center">Comments</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">(-)</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm font-semibold text-slate-500">
                        You have no request history
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-600 whitespace-nowrap">
                          {new Date(req.startDate).toLocaleDateString('en-GB')}
                          {req.startDate !== req.endDate && (
                            <span className="text-slate-400"> – {new Date(req.endDate).toLocaleDateString('en-GB')}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700 whitespace-nowrap">
                          {req.leaveTypeName || leaveTypesList.find((t) => t.key === req.leaveType)?.label || req.leaveType}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500 max-w-[160px] truncate">{req.note || '—'}</td>
                        <td className="py-3 px-4 text-center text-slate-400 whitespace-nowrap">
                          {new Date(req.submittedDate).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400 italic text-xs">
                          {req.approverComments || '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            req.status === 'pending'  ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            'bg-red-50 text-red-700 border border-red-100'
                          }`}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {req.totalDays}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleRecall(req.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Recall / Reset to Pending"
                            >
                              <RefreshCcw size={14} />
                            </button>
                            <button
                              onClick={() => handleCancel(req.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Cancel request"
                            >
                              <XCircle size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          );
        })() : (() => {
          const filteredLedger = ledger.filter((l) => l.leaveType === selectedLeaveType);
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                    <th className="py-3 px-4 text-center">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-center">Used</th>
                    <th className="py-3 px-4 text-center">Earned</th>
                    <th className="py-3 px-4 text-center">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-sm font-semibold text-slate-500">
                        You have no balance history
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-500 whitespace-nowrap">
                          {new Date(entry.date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{entry.description}</td>
                        <td className="py-3 px-4 text-center font-bold text-red-600">
                          {entry.change < 0 ? `${entry.change}d` : '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-600">
                          {entry.change > 0 ? `+${entry.change}d` : '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-extrabold text-slate-800">{entry.balance}d</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

