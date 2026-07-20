import { useState } from 'react';
import { Check, X, MessageSquare, Download, Calendar } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';
import type { AdminLeaveRequest } from '../types/adminTypes';
import SearchInput from '../components/ui/SearchInput';
import { SelectFilter } from '../components/ui/SelectFilter';
import StatusBadge from '../components/ui/StatusBadge';
import SlideDrawer from '../components/ui/SlideDrawer';

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
  const { state, dispatch } = useAdmin();
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Modals & Selection
  const [selected, setSelected] = useState<AdminLeaveRequest | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [hrNote, setHrNote] = useState('');
  const [noteId, setNoteId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const departments = [...new Set(state.employees.map(e => e.department))];
  const countries = [...new Set(state.employees.map(e => e.country))];

  const filtered = state.leaveRequests.filter(req => {
    const emp = state.employees.find(e => e.id === req.employeeId);
    const q = search.toLowerCase();
    
    const matchesEmp = !q || emp?.name.toLowerCase().includes(q);
    const matchesStatus = !filterStatus || req.status === filterStatus;
    const matchesType = !filterType || req.leaveType === filterType;
    const matchesDept = !filterDept || emp?.department === filterDept;
    const matchesCountry = !filterCountry || emp?.country === filterCountry;
    const matchesStartDate = !filterStartDate || req.startDate >= filterStartDate;
    const matchesEndDate = !filterEndDate || req.endDate <= filterEndDate;

    return matchesEmp && matchesStatus && matchesType && matchesDept && matchesCountry && matchesStartDate && matchesEndDate;
  });

  function exportCsv() {
    const rows = [['Employee', 'Type', 'Start', 'End', 'Days', 'Status', 'Balance Before', 'Balance After']];
    filtered.forEach(r => {
      const emp = state.employees.find(e => e.id === r.employeeId);
      rows.push([
        emp?.name ?? '',
        r.leaveType,
        r.startDate,
        r.endDate,
        String(r.totalDays),
        r.status,
        String(r.balanceBefore ?? ''),
        String(r.balanceAfter ?? '')
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

  function handleApprove(id: number) {
    const req = state.leaveRequests.find(r => r.id === id);
    if (!req) return;
    
    const emp = state.employees.find(e => e.id === req.employeeId);
    const appConfig = state.approvalLevels.find(c => c.id === emp?.approvalLevelId);
    
    dispatch({ type: 'APPROVE_REQUEST', payload: { id } });
    
    if (appConfig && appConfig.levelsCount > 1) {
      const curStage = req.currentApprovalStage || 1;
      if (curStage < appConfig.levelsCount) {
        setToast(`Approved stage ${curStage} of ${appConfig.levelsCount}. Request remains pending next stage.`);
        setTimeout(() => setToast(null), 3000);
        return;
      }
    }
    setToast(`Leave request fully approved for ${emp?.name}`);
    setTimeout(() => setToast(null), 3000);
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
          <p className="text-slate-400 text-sm mt-1">{state.leaveRequests.filter(r => r.status === 'pending').length} pending · {filtered.length} total</p>
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
                <th className="py-3.5 px-4 text-center">Bal. Before</th>
                <th className="py-3.5 px-4 text-center">Bal. After</th>
                <th className="py-3.5 px-4 text-center">Approval Stage</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-16 text-center text-slate-400 text-sm">No requests found</td></tr>
              )}
              {filtered.map(req => {
                const emp = state.employees.find(e => e.id === req.employeeId);
                const appConfig = state.approvalLevels.find(c => c.id === emp?.approvalLevelId);
                const stageText = appConfig 
                  ? `Stage ${req.currentApprovalStage || 1} of ${appConfig.levelsCount}`
                  : '1 Level';

                return (
                  <tr key={req.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setSelected(req)}>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-gradient-to-br from-violet-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-black">{emp?.name.charAt(0)}</div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{emp?.name}</p>
                          <p className="text-[10px] text-slate-400">{emp?.department} · {emp?.country}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 capitalize">{req.leaveType.replace('_',' ')}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {new Date(req.startDate).toLocaleDateString('en-GB')} → {new Date(req.endDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-700 dark:text-slate-300 text-xs">{req.totalDays}</td>
                    <td className="py-3.5 px-4 text-center text-xs text-slate-500">{req.balanceBefore ?? '—'}</td>
                    <td className="py-3.5 px-4 text-center text-xs text-slate-500">{req.balanceAfter ?? '—'}</td>
                    <td className="py-3.5 px-4 text-center text-xs text-slate-500 font-semibold">{stageText}</td>
                    <td className="py-3.5 px-4 text-center"><StatusBadge status={req.status as any} /></td>
                    <td className="py-3.5 px-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {req.status === 'pending' && (<>
                          <button onClick={() => handleApprove(req.id)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 cursor-pointer" title="Approve"><Check size={14}/></button>
                          <button onClick={() => { setRejectId(req.id); setRejectComment(''); }} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer" title="Reject"><X size={14}/></button>
                        </>)}
                        <button onClick={() => { setNoteId(req.id); setHrNote(req.hrNote ?? ''); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer" title="Add Note"><MessageSquare size={14}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      <SlideDrawer isOpen={!!selected} onClose={() => setSelected(null)} title="Request Details" subtitle={selected ? `${selected.leaveType.replace('_',' ')} leave — ${selected.totalDays} days` : ''}>
        {selected && (() => {
          const emp = state.employees.find(e => e.id === selected.employeeId);
          const appConfig = state.approvalLevels.find(c => c.id === emp?.approvalLevelId);
          
          return (
            <div className="p-6 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-indigo-500 rounded-xl flex items-center justify-center text-white text-lg font-black">{emp?.name.charAt(0)}</div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">{emp?.name}</p>
                  <p className="text-sm text-slate-500">{emp?.department} · {emp?.country}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Leave Type', selected.leaveType.replace('_',' ')],
                  ['Status', selected.status],
                  ['Start Date', new Date(selected.startDate).toLocaleDateString('en-GB')],
                  ['End Date', new Date(selected.endDate).toLocaleDateString('en-GB')],
                  ['Total Days', `${selected.totalDays} days`],
                  ['Submitted', new Date(selected.submittedDate).toLocaleDateString('en-GB')],
                  ['Balance Before', selected.balanceBefore !== undefined ? `${selected.balanceBefore} days` : '—'],
                  ['Balance After',  selected.balanceAfter  !== undefined ? `${selected.balanceAfter} days`  : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k}</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5 capitalize">{v}</p>
                  </div>
                ))}
              </div>

              {/* Multi-Stage Tracker */}
              {appConfig && (
                <div className="bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approval workflow: {appConfig.name}</h4>
                  
                  <div className="space-y-2">
                    {appConfig.levels.map((lvl, index) => {
                      const levelNum = index + 1;
                      const log = selected.approvalsLog?.find(item => item.level === levelNum);
                      
                      let statusText = 'Pending';
                      let statusColor = 'text-slate-400';
                      
                      if (log) {
                        statusText = log.status === 'approved' ? 'Approved' : 'Rejected';
                        statusColor = log.status === 'approved' ? 'text-emerald-500 font-bold' : 'text-red-500 font-bold';
                      } else if (selected.status === 'declined') {
                        statusText = 'Cancelled';
                        statusColor = 'text-slate-400 line-through';
                      } else if ((selected.currentApprovalStage || 1) === levelNum && selected.status === 'pending') {
                        statusText = 'Awaiting Approval';
                        statusColor = 'text-violet-600 dark:text-violet-400 font-bold animate-pulse';
                      }

                      return (
                        <div key={index} className="flex justify-between items-center text-xs">
                          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <span className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-[9px] font-bold text-slate-500">{levelNum}</span>
                            {lvl.type === 'manager' && 'Direct Manager'}
                            {lvl.type === 'manager_manager' && "Manager's Manager"}
                            {lvl.type === 'specific_employee' && `Specific Employee (${lvl.specificEmployeeEmail})`}
                          </span>
                          <span className={statusColor}>
                            {statusText} {log?.comment ? `("${log.comment}")` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selected.note && <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3"><p className="text-xs text-blue-700 dark:text-blue-300 italic">"{selected.note}"</p></div>}
              {selected.approverComments && <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Approver Comment</p><p className="text-sm text-slate-600 dark:text-slate-300">{selected.approverComments}</p></div>}
              {selected.hrNote && <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-xl p-3"><p className="text-[10px] font-bold text-violet-500 uppercase mb-1">HR Note</p><p className="text-sm text-violet-700 dark:text-violet-300">{selected.hrNote}</p></div>}
              
              {selected.status === 'pending' && (
                <div className="flex gap-3">
                  <button onClick={() => { handleApprove(selected.id); setSelected(null); }} className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-emerald-700 cursor-pointer flex items-center justify-center gap-2"><Check size={15}/>Approve</button>
                  <button onClick={() => { setRejectId(selected.id); setRejectComment(''); setSelected(null); }} className="flex-1 bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-red-700 cursor-pointer flex items-center justify-center gap-2"><X size={15}/>Reject</button>
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
              <button disabled={!rejectComment.trim()} onClick={() => { dispatch({ type: 'REJECT_REQUEST', payload: { id: rejectId, comment: rejectComment } }); setRejectId(null); setToast('Leave request declined'); setTimeout(() => setToast(null), 3000); }} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 disabled:opacity-50 cursor-pointer">Reject</button>
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
              <button onClick={() => { dispatch({ type: 'ADD_NOTE', payload: { id: noteId, note: hrNote } }); setNoteId(null); setToast('HR internal note updated'); setTimeout(() => setToast(null), 3000); }} className="flex-1 py-2.5 bg-violet-600 text-white font-bold rounded-xl text-sm hover:bg-violet-700 cursor-pointer">Save Note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
