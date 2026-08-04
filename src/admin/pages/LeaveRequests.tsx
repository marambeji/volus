import { useState, useEffect } from 'react';
import { Check, X, MessageSquare, Download, Calendar, History } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';
import SearchInput from '../components/ui/SearchInput';
import { SelectFilter } from '../components/ui/SelectFilter';
import StatusBadge from '../components/ui/StatusBadge';
import SlideDrawer from '../components/ui/SlideDrawer';
import HistoryDrawer from '../components/HistoryDrawer';
import { hrGetLeaveRequests, hrApproveLeaveRequest, hrRejectLeaveRequest } from '../../services/adminApi';

const leaveTypeOptions = [
  { label: 'Annual',      value: 'annual' },
  { label: 'Sick',        value: 'sick' },
  { label: 'Maternity',   value: 'maternity' },
  { label: 'Paternity',   value: 'paternity' },
  { label: 'Bereavement', value: 'bereavement' },
  { label: 'Compensation',value: 'compensation' },
  { label: 'Unpaid',      value: 'unpaid' },
  { label: 'Overtime',    value: 'overtime' },
];

export default function LeaveRequests() {
  const {} = useAdmin();
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Modals & Selection
  const [selected, setSelected] = useState<any | null>(null);
  const [rejectId, setRejectId] = useState<number | string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [hrNote, setHrNote] = useState('');
  const [noteId, setNoteId] = useState<number | string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ entityType: string; entityId: string; name: string } | null>(null);

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const departments = [...new Set(requests.map(r => r.department).filter(Boolean))];
  const countries = [...new Set(requests.map(r => r.country).filter(Boolean))];

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await hrGetLeaveRequests();
      setRequests(res);
    } catch (e) {
      console.error(e);
      setToast('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const filtered = requests.filter(req => {
    const q = search.toLowerCase();
    
    const matchesEmp = !q || req.employeeName?.toLowerCase().includes(q) || req.employeeEmail?.toLowerCase().includes(q);
    const matchesStatus = !filterStatus || req.currentStatus === filterStatus;
    const matchesType = !filterType || req.leaveTypeId === filterType;
    const matchesDept = !filterDept || req.department === filterDept;
    const matchesCountry = !filterCountry || req.country === filterCountry;
    const matchesStartDate = !filterStartDate || req.startDate >= filterStartDate;
    const matchesEndDate = !filterEndDate || req.endDate <= filterEndDate;

    return matchesEmp && matchesStatus && matchesType && matchesDept && matchesCountry && matchesStartDate && matchesEndDate;
  });

  function exportCsv() {
    const rows = [['Employee', 'Type', 'Start', 'End', 'Days', 'Status']];
    filtered.forEach(r => {
      rows.push([
        r.employeeName ?? '',
        r.leaveTypeName ?? r.leaveTypeId,
        r.startDate,
        r.endDate,
        String(r.requestedDuration),
        r.currentStatus
      ]);
    });
    const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leave_requests_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  async function handleApprove(id: string) {
    try {
      await hrApproveLeaveRequest(id);
      setToast('Leave request fully approved');
      loadRequests();
      window.dispatchEvent(new Event('leave-request-submitted'));
    } catch (e: any) {
      setToast(e.message || 'Failed to approve');
    }
  }

  async function handleReject(id: string, reason: string) {
    if (!reason.trim()) return;
    try {
      await hrRejectLeaveRequest(id, reason);
      setToast('Leave request declined');
      setRejectId(null);
      loadRequests();
      window.dispatchEvent(new Event('leave-request-submitted'));
    } catch (e: any) {
      setToast(e.message || 'Failed to reject');
    }
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 relative">
      
      {/* Toast alert */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300 rounded-xl shadow-lg transition-all">
          <Check size={16} />
          <span className="text-xs font-semibold">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Leave Requests</h1>
          <p className="text-slate-400 text-sm mt-1">{requests.filter(r => r.currentStatus === 'PENDING').length} pending · {filtered.length} total</p>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48"><SearchInput value={search} onChange={setSearch} placeholder="Search employee..." /></div>
        <SelectFilter label="Status"     value={filterStatus} onChange={setFilterStatus} options={[{ label:'Pending', value:'pending' }, { label:'Approved', value:'approved' }, { label:'Declined', value:'declined' }, { label:'Cancelled', value:'cancelled' }]} />
        <SelectFilter label="Leave Type" value={filterType}   onChange={setFilterType}   options={leaveTypeOptions} />
        <SelectFilter label="Department" value={filterDept}   onChange={setFilterDept}   options={departments.map(d => ({ label: d, value: d }))} />
        <SelectFilter label="Country"    value={filterCountry} onChange={setFilterCountry} options={countries.map(c => ({ label: c, value: c }))} />
        
        {/* Date Range Filters */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs">
          <Calendar size={13} className="text-slate-400" />
          <span className="text-slate-400">From:</span>
          <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none" />
          <span className="text-slate-400 ml-1">To:</span>
          <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-[11px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50/50">
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Leave Type</th>
                <th className="py-3.5 px-4">Dates</th>
                <th className="py-3.5 px-4 text-center">Days</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={9} className="py-16 text-center text-slate-400 text-sm">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center text-slate-400 text-sm">No requests found</td></tr>
              ) : (
                filtered.map(req => {
                  return (
                    <tr key={req.requestId} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setSelected(req)}>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-gradient-to-br from-violet-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-black">{req.employeeName?.charAt(0)}</div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{req.employeeName}</p>
                            <p className="text-[10px] text-slate-400">{req.department} · {req.country}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 capitalize">{req.leaveTypeName ?? req.leaveTypeId}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {new Date(req.startDate).toLocaleDateString('en-GB')} → {new Date(req.endDate).toLocaleDateString('en-GB')}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700 dark:text-slate-300 text-xs">{req.requestedDuration}</td>
                      <td className="py-3.5 px-4 text-center"><StatusBadge status={req.currentStatus.toLowerCase() as any} /></td>
                      <td className="py-3.5 px-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setHistoryTarget({ entityType: 'LeaveRequest', entityId: req.requestId, name: `${req.employeeName} Request` })} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer" title="Audit History"><History size={14}/></button>
                          {req.canApprove ? (
                            <>
                              <button onClick={() => handleApprove(req.requestId)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 cursor-pointer" title="Approve"><Check size={14}/></button>
                              <button onClick={() => { setRejectId(req.requestId); setRejectComment(''); }} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer" title="Reject"><X size={14}/></button>
                            </>
                          ) : req.currentStatus === 'PENDING' ? (
                            <span className="text-[10px] italic font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-200/60 dark:border-amber-900/50">
                              Waiting for Manager approval
                            </span>
                          ) : null}
                          <button onClick={() => { setNoteId(req.requestId); setHrNote(req.hrNote ?? ''); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer" title="Add Note"><MessageSquare size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      <SlideDrawer isOpen={!!selected} onClose={() => setSelected(null)} title="Request Details" subtitle={selected ? `${selected.leaveTypeName ?? selected.leaveTypeId} leave — ${selected.requestedDuration} days` : ''}>
        {selected && (() => {
          return (
            <div className="p-6 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-indigo-500 rounded-xl flex items-center justify-center text-white text-lg font-black">{selected.employeeName?.charAt(0)}</div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">{selected.employeeName}</p>
                  <p className="text-sm text-slate-500">{selected.department} · {selected.country}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Leave Type', selected.leaveTypeName ?? selected.leaveTypeId],
                  ['Status', selected.currentStatus],
                  ['Start Date', new Date(selected.startDate).toLocaleDateString('en-GB')],
                  ['End Date', new Date(selected.endDate).toLocaleDateString('en-GB')],
                  ['Total Days', `${selected.requestedDuration} days`],
                  ['Submitted', new Date(selected.submittedAt).toLocaleDateString('en-GB')],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k}</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5 capitalize">{v}</p>
                  </div>
                ))}
              </div>

              {selected.employeeNote && <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3"><p className="text-xs text-blue-700 dark:text-blue-300 italic">"{selected.employeeNote}"</p></div>}
              {selected.rejectionReason && <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Rejection Reason</p><p className="text-sm text-slate-600 dark:text-slate-300">{selected.rejectionReason}</p></div>}
              {selected.hrNote && <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-xl p-3"><p className="text-[10px] font-bold text-violet-500 uppercase mb-1">HR Note</p><p className="text-sm text-violet-700 dark:text-violet-300">{selected.hrNote}</p></div>}
              
              {selected.currentStatus === 'PENDING' && (
                <div className="flex gap-3">
                  <button onClick={() => { handleApprove(selected.requestId); setSelected(null); }} className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-emerald-700 cursor-pointer flex items-center justify-center gap-2"><Check size={15}/>Approve</button>
                  <button onClick={() => { setRejectId(selected.requestId); setRejectComment(''); setSelected(null); }} className="flex-1 bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-red-700 cursor-pointer flex items-center justify-center gap-2"><X size={15}/>Reject</button>
                </div>
              )}
            </div>
          );
        })()}
      </SlideDrawer>

      {/* Reject Modal */}
      {rejectId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-100 dark:border-slate-700 animate-slide-in">
            <h3 className="font-bold text-slate-800 dark:text-white mb-3">Reject Request</h3>
            <textarea rows={3} value={rejectComment} onChange={e => setRejectComment(e.target.value)} placeholder="Reason for rejection (required)" className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-500" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectId(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl text-sm cursor-pointer">Cancel</button>
              <button disabled={!rejectComment.trim()} onClick={() => { handleReject(rejectId as string, rejectComment); }} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 disabled:opacity-50 cursor-pointer">Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {noteId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-100 dark:border-slate-700 animate-slide-in">
            <h3 className="font-bold text-slate-800 dark:text-white mb-3">Add HR Note</h3>
            <textarea rows={3} value={hrNote} onChange={e => setHrNote(e.target.value)} placeholder="Add an HR internal note..." className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setNoteId(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl text-sm cursor-pointer">Cancel</button>
              <button onClick={() => { setNoteId(null); setToast('HR internal note updated'); setTimeout(() => setToast(null), 3000); }} className="flex-1 py-2.5 bg-violet-600 text-white font-bold rounded-xl text-sm hover:bg-violet-700 cursor-pointer">Save Note</button>
            </div>
          </div>
        </div>
      )}
      {/* Audit History Drawer */}
      <HistoryDrawer
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        entityType={historyTarget?.entityType || ''}
        entityId={historyTarget?.entityId || ''}
        entityName={historyTarget?.name}
      />
    </div>
  );
}
