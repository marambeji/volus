import { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, CalendarDays, ArrowRightLeft, History, XCircle, Eye } from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import SlideDrawer from '../admin/components/ui/SlideDrawer';
import ConfirmModal from '../admin/components/ui/ConfirmModal';
import ApprovalProgressTimeline from '../components/ui/ApprovalProgressTimeline';
import { apiFetch } from '../services/apiClient';

function hasPassed(endDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(endDate) < today;
}

export default function MyInfo() {
  const [selectedLeaveType, setSelectedLeaveType] = useState('annual');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [tableMode, setTableMode] = useState<'requests' | 'ledger'>('requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        let currentUserId: string | undefined;
        try {
          const stored = localStorage.getItem('currentUser');
          if (stored) currentUserId = JSON.parse(stored)?.id;
        } catch {
          // ignore malformed localStorage
        }

        const [realRequests, realBalancesData, meData, realLedgerData] = await Promise.all([
          apiFetch<any[]>('/leave-requests/my-requests').catch(() => null),
          apiFetch<any>('/employees/me/leave-balances').catch(() => null),
          apiFetch<any>('/employees/me').catch(() => null),
          currentUserId
            ? apiFetch<{ data: any[] }>(`/leave-balances/ledger?employeeId=${currentUserId}&limit=50`).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (meData) {
          setProfile(meData);
        }

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
            approvalInstances: r.approvalInstances || [],
            rejectionReason: r.rejectionReason,
            currentStepOrder: r.currentStepOrder,
            totalRequiredSteps: r.totalRequiredSteps,
            currentApproverLabel: r.currentApproverLabel,
            updatedAt: r.updatedAt,
          }));
          setRequests(mapped);
        }

        let resolvedBalances = balances;
        if (realBalancesData && realBalancesData.balances && realBalancesData.balances.length > 0) {
          resolvedBalances = realBalancesData.balances;
          setBalances(resolvedBalances);
        }

        if (realLedgerData?.data) {
          const typeIdToCode: Record<string, string> = {};
          resolvedBalances.forEach((b: any) => {
            if (b.leaveTypeId) typeIdToCode[b.leaveTypeId] = b.code || b.leaveType || b.leaveTypeId;
          });

          const mappedLedger = realLedgerData.data.map((l: any) => ({
            date: new Date(l.createdAt).toLocaleDateString('en-GB'),
            description: l.description,
            leaveType: typeIdToCode[l.leaveTypeId] || l.leaveTypeId,
            used: l.usedDays || 0,
            earned: l.earnedDays || 0,
            runningBalance: l.balanceAfter,
          }));
          setLedger(mappedLedger);
        }
      } catch (err) {
        console.error('Failed to load real MyInfo data:', err);
      }
    }
    void loadData();
    const handleRefetch = () => { void loadData(); };
    window.addEventListener('leave-request-submitted', handleRefetch);
    return () => { window.removeEventListener('leave-request-submitted', handleRefetch); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Build display values from profile (real) or fallback
  const displayName     = profile?.fullName     ?? '—';
  const displayRole     = profile?.jobTitle      ?? '—';
  const displayDept     = profile?.department    ?? '—';
  const displayEmail    = profile?.email         ?? '—';
  const displayPhone    = profile?.phone         ?? '—';
  const displayLocation = profile?.country       ? `${profile.country}` : '—';
  const displayStart    = profile?.hireDate
    ? new Date(profile.hireDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  async function handleConfirmCancel() {
    if (!cancelTarget || cancellingId) return;
    const target = cancelTarget;
    setCancellingId(target.id);
    try {
      try {
        await apiFetch(`/leave-requests/${target.id}/cancel`, { method: 'PATCH' });
      } catch {
        await apiFetch(`/leave-requests/${target.id}/cancel`, { method: 'PUT' });
      }
      setToast({ message: 'Leave request cancelled successfully.', type: 'success' });
      window.dispatchEvent(new Event('leave-request-submitted'));
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to cancel leave request.', type: 'error' });
    } finally {
      setCancellingId(null);
      setCancelTarget(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {/* Page Title & Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center gap-4 text-center justify-center">
          <Avatar name={displayName} size="lg" />
          <div>
            <h2 className="text-slate-800 font-extrabold text-lg">{displayName}</h2>
            <p className="text-slate-400 text-xs mt-0.5">{displayRole}</p>
            <div className="mt-2.5">
              <Badge label={displayDept} variant="department" />
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
              <p className="text-slate-700 text-sm font-semibold">{displayEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
              <Phone size={15} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Phone</p>
              <p className="text-slate-700 text-sm font-semibold">{displayPhone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
              <MapPin size={15} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Location</p>
              <p className="text-slate-700 text-sm font-semibold">{displayLocation}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
              <CalendarDays size={15} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Start Date</p>
              <p className="text-slate-700 text-sm font-semibold">{displayStart}</p>
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
            // Always show the remaining/available balance (entitlement - used),
            // same as the admin balances panel — a fresh USAGE_YTD type (Sick,
            // Maternity, ...) with nothing used yet should read as its full
            // entitlement, not a misleading 0.
            const value = item.availableBalance ?? item.amount ?? 0;
            const label = item.name || item.label || key;
            const isSelected = selectedLeaveType === key || selectedLeaveType === item.leaveTypeId;

            // Equation data
            const total = item.annualEntitlement ?? 0;
            const used = Number(item.approvedUsed ?? item.usageYtd ?? 0);
            const remaining = Number(value);

            return (
              <div
                key={key}
                onClick={() => setSelectedLeaveType(key)}
                className={`flex-shrink-0 w-40 p-4 rounded-xl border transition-all cursor-pointer ${isSelected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                    : 'bg-white border-slate-100 text-slate-700 hover:border-blue-200'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color || '#3B82F6' }} />
                  <span className={`text-[10px] font-bold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                    Available
                  </span>
                </div>
                <p className="text-2xl font-extrabold">{value}d</p>
                <p className={`text-xs truncate font-medium mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                  {label}
                </p>
                {/* Equation: total - used = remaining */}
                {total > 0 && (
                  <p className={`text-[10px] font-mono mt-1.5 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                    {total} − {used} = {remaining}j
                  </p>
                )}
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
                    <th className="py-3 px-4 text-center">Progress</th>
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
                      <tr
                        key={req.id}
                        onClick={() => setSelectedReq(req)}
                        className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 text-center text-slate-600 whitespace-nowrap">
                          {new Date(req.startDate).toLocaleDateString('en-GB')}
                          {req.startDate !== req.endDate && (
                            <span className="text-slate-400"> – {new Date(req.endDate).toLocaleDateString('en-GB')}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700 whitespace-nowrap">
                          {req.leaveTypeName || req.leaveType}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500 max-w-[160px] truncate">{req.note || '—'}</td>
                        <td className="py-3 px-4 text-center text-slate-400 whitespace-nowrap">
                          {new Date(req.submittedDate).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {req.approvalInstances && req.approvalInstances.length > 0 ? (
                            <ApprovalProgressTimeline
                              steps={req.approvalInstances}
                              requestStatus={req.status.toUpperCase()}
                              compact={true}
                            />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            req.status === 'approved'  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            req.status === 'pending'   ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            req.status === 'cancelled' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                            'bg-red-50 text-red-700 border border-red-100'
                          }`}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </span>
                          {req.status === 'cancelled' && req.updatedAt && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Cancelled {new Date(req.updatedAt).toLocaleDateString('en-GB')}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {req.totalDays}
                        </td>
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedReq(req)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                              title="View Approval Progress"
                            >
                              <Eye size={14} />
                            </button>
                            {req.status === 'pending' && !hasPassed(req.endDate) && (
                              <button
                                onClick={() => setCancelTarget(req)}
                                disabled={cancellingId === req.id}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                title="Cancel request"
                              >
                                <XCircle size={14} />
                              </button>
                            )}
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
                  {filteredLedger.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-500 whitespace-nowrap">{row.date}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{row.description}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-600">{row.used ? `-${row.used}` : '—'}</td>
                      <td className="py-3 px-4 text-center font-semibold text-emerald-600">{row.earned ? `+${row.earned}` : '—'}</td>
                      <td className="py-3 px-4 text-center font-extrabold text-slate-800">{row.runningBalance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* Approval Progress Details Drawer */}
        <SlideDrawer
          isOpen={!!selectedReq}
          onClose={() => setSelectedReq(null)}
          title="Approval Progress & Request Details"
          subtitle={selectedReq ? `${selectedReq.leaveTypeName} (${selectedReq.totalDays} ${selectedReq.totalDays === 1 ? 'day' : 'days'})` : ''}
        >
          {selectedReq && (
            <div className="p-6 flex flex-col gap-6">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/80 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dates</span>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                    {new Date(selectedReq.startDate).toLocaleDateString('en-GB')} → {new Date(selectedReq.endDate).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Status</span>
                  <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    {selectedReq.status}
                  </span>
                </div>
                {selectedReq.note && (
                  <div className="mt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Note</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                      "{selectedReq.note}"
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                  Approval Timeline
                </h3>
                <ApprovalProgressTimeline
                  submittedAt={selectedReq.submittedDate}
                  steps={selectedReq.approvalInstances || []}
                  requestStatus={selectedReq.status.toUpperCase()}
                  rejectionReason={selectedReq.rejectionReason}
                />
              </div>
            </div>
          )}
        </SlideDrawer>
      </div>

      {/* Toast Alert Banner */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg transition-all duration-300 ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Cancel Confirmation */}
      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        title="Cancel Leave Request"
        message="Are you sure you want to cancel this leave request?"
        confirmLabel="Cancel Request"
        danger
        confirming={!!cancelTarget && cancellingId === cancelTarget.id}
      />
    </div>
  );
}
