import { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';
import type { CountryPolicy, LeaveQuota } from '../types/adminTypes';
import type { LeaveTypeKey } from '../../types';
import SearchInput from '../components/ui/SearchInput';
import SlideDrawer from '../components/ui/SlideDrawer';
import ConfirmModal from '../components/ui/ConfirmModal';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const allLeaveTypes: { key: LeaveTypeKey; label: string }[] = [
  { key: 'annual', label: 'Annual' },
  { key: 'sick', label: 'Sick' },
  { key: 'bereavement', label: 'Bereavement' },
  { key: 'wedding', label: 'Wedding' },
  { key: 'paternity', label: 'Paternity' },
  { key: 'maternity', label: 'Maternity' },
  { key: 'public_holiday', label: 'Public Holiday' },
  { key: 'compensation', label: 'Compensation' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'overtime', label: 'Overtime' }
];

const defaultQuota = (type: LeaveTypeKey): LeaveQuota => ({
  leaveType: type,
  entitlementDays: 10,
  isAccrued: false,
  accrualRate: 0,
  carryOverEnabled: false,
  maxCarryOver: 0,
  maxConsecutive: 10,
  minNoticeDays: 0,
  accrualInterval: 'yearly',
  seniorityMilestones: [],
  isCutOffDifferentFromHireDate: false,
  cutOffDate: '',
  carryOverExpiration: '',
  maxBalanceCap: 99,
  resetDate: '01-01',
  resetDaysCount: 0,
  waitingPeriodDays: 0
});

const emptyForm = (): Omit<CountryPolicy, 'id'> & { id?: string } => ({
  policyName: '',
  country: '',
  countryCode: '',
  flag: '🏳️',
  weekendDays: [0, 6],
  workingHoursPerDay: 8,
  approvalWorkflow: 'app-1',
  leaveQuotas: allLeaveTypes.map(lt => defaultQuota(lt.key)),
  divisionAssignment: '',
  createdAt: new Date().toISOString().split('T')[0],
  updatedAt: new Date().toISOString().split('T')[0]
});

export default function LeavePolicies() {
  const { state, dispatch } = useAdmin();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editPol, setEditPol] = useState<CountryPolicy | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Form State
  const [form, setForm] = useState<Omit<CountryPolicy, 'id'> & { id?: string }>(emptyForm());
  const [activeTab, setActiveTab] = useState<'general' | 'quotas'>('general');
  const [selectedQuotaIndex, setSelectedQuotaIndex] = useState<number>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = state.policies.filter(p => 
    p.policyName.toLowerCase().includes(search.toLowerCase()) || 
    p.country.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setForm(emptyForm());
    setEditPol(null);
    setActiveTab('general');
    setSelectedQuotaIndex(0);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(policy: CountryPolicy) {
    setForm({
      ...policy,
      leaveQuotas: allLeaveTypes.map(lt => {
        const existing = policy.leaveQuotas.find(q => q.leaveType === lt.key);
        return existing ? { ...defaultQuota(lt.key), ...existing } : defaultQuota(lt.key);
      })
    });
    setEditPol(policy);
    setActiveTab('general');
    setSelectedQuotaIndex(0);
    setErrors({});
    setFormOpen(true);
  }

  function handleWeekendToggle(dayIndex: number) {
    const isWeekend = form.weekendDays.includes(dayIndex);
    const nextWeekend = isWeekend 
      ? form.weekendDays.filter(d => d !== dayIndex)
      : [...form.weekendDays, dayIndex].sort();
    setForm(p => ({ ...p, weekendDays: nextWeekend }));
  }

  function handleQuotaChange<K extends keyof LeaveQuota>(index: number, key: K, val: LeaveQuota[K]) {
    const nextQuotas = [...form.leaveQuotas];
    nextQuotas[index] = { ...nextQuotas[index], [key]: val };
    setForm(p => ({ ...p, leaveQuotas: nextQuotas }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.policyName.trim()) newErrors.policyName = 'Policy Name is required';
    if (!form.country.trim()) newErrors.country = 'Country is required';
    if (!form.countryCode.trim()) newErrors.countryCode = 'Country Code is required';
    
    form.leaveQuotas.forEach((q, idx) => {
      if (q.isAccrued && (q.accrualRate ?? 0) < 0) {
        newErrors[`quota_${idx}_rate`] = 'Accrual rate must be zero or positive';
      }
      if (q.carryOverEnabled && (q.maxCarryOver ?? 0) < 0) {
        newErrors[`quota_${idx}_carry`] = 'Max carry over cannot be negative';
      }
      if (q.isCutOffDifferentFromHireDate && !q.cutOffDate?.trim()) {
        newErrors[`quota_${idx}_cutoff`] = 'Cut-off date is required when custom is selected';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: CountryPolicy = {
      ...form,
      id: form.id || `pol-${Date.now()}`,
      createdAt: editPol?.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    } as CountryPolicy;

    if (editPol) {
      dispatch({ type: 'UPDATE_POLICY', payload });
    } else {
      dispatch({ type: 'ADD_POLICY', payload });
    }
    setFormOpen(false);
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Leave Policies</h1>
          <p className="text-slate-400 text-sm mt-1">Configure leave rules, accrual intervals, and weekends by country</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer">
          <Plus size={16} /> Add Policy
        </button>
      </div>

      <div className="w-full sm:w-64">
        <SearchInput value={search} onChange={setSearch} placeholder="Search policies..." />
      </div>

      {/* Grid of Policies */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(policy => (
          <div key={policy.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between hover:border-violet-300 transition-colors">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{policy.flag}</span>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-base">{policy.policyName}</h3>
                    <p className="text-xs text-slate-500">{policy.country} · {policy.countryCode} {policy.divisionAssignment ? `· ${policy.divisionAssignment}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(policy)} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-violet-600 rounded-xl transition-colors cursor-pointer" title="Edit"><Edit2 size={13}/></button>
                  <button onClick={() => setDeleteId(policy.id)} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer" title="Delete"><Trash2 size={13}/></button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md text-[10px] font-bold">Weekends: {policy.weekendDays.map(d => dayNames[d].slice(0,3)).join(', ')}</span>
                <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md text-[10px] font-bold">{policy.workingHoursPerDay} hrs/day</span>
                <span className="bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 px-2 py-1 rounded-md text-[10px] font-bold">
                  Workflow: {state.approvalLevels.find(l => l.id === policy.approvalWorkflow)?.name || 'Standard 1-Level'}
                </span>
              </div>

              <div className="flex-1 space-y-2 mt-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Leave Quotas Overview</h4>
                {policy.leaveQuotas.slice(0, 4).map(q => (
                  <div key={q.leaveType} className="flex justify-between text-xs border-b border-slate-50 dark:border-slate-700/50 pb-1.5">
                    <span className="text-slate-600 dark:text-slate-400 capitalize">{q.leaveType.replace('_',' ')}</span>
                    <div className="flex items-center gap-2">
                      {q.isAccrued && <span className="text-[9px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-1 rounded">Accrued</span>}
                      <span className="font-bold text-slate-800 dark:text-slate-200">{q.entitlementDays}d</span>
                    </div>
                  </div>
                ))}
                {policy.leaveQuotas.length > 4 && (
                  <p className="text-[10px] text-slate-400 italic pt-1">+ {policy.leaveQuotas.length - 4} more types configured</p>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 text-sm">No policies found</div>
        )}
      </div>

      {/* SlideDrawer for Add/Edit Policy */}
      <SlideDrawer isOpen={formOpen} onClose={() => setFormOpen(false)} title={editPol ? 'Edit Policy' : 'Add Policy'} subtitle={editPol ? `Modifying ${editPol.policyName}` : 'Set up leave quotas and weekend structures'} width="max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full bg-white dark:bg-slate-800">
          
          {/* Tab Headers */}
          <div className="flex border-b border-slate-100 dark:border-slate-700 px-6">
            <button type="button" onClick={() => setActiveTab('general')} className={`py-4 px-4 font-bold text-sm border-b-2 transition-colors cursor-pointer ${activeTab === 'general' ? 'border-violet-600 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              General Settings
            </button>
            <button type="button" onClick={() => setActiveTab('quotas')} className={`py-4 px-4 font-bold text-sm border-b-2 transition-colors cursor-pointer ${activeTab === 'quotas' ? 'border-violet-600 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              Leave Quotas & Rules
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            
            {/* ─── GENERAL SETTINGS TAB ─── */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Policy Name *</label>
                    <input type="text" required value={form.policyName} onChange={e => setForm(p => ({ ...p, policyName: e.target.value }))} placeholder="e.g. Lebanon Standard" className={`w-full px-3 py-2 text-sm border ${errors.policyName ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-slate-50 dark:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`} />
                    {errors.policyName && <p className="text-red-500 text-[10px] mt-1">{errors.policyName}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country *</label>
                    <input type="text" required value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="e.g. Lebanon" className={`w-full px-3 py-2 text-sm border ${errors.country ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-slate-50 dark:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`} />
                    {errors.country && <p className="text-red-500 text-[10px] mt-1">{errors.country}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country Code *</label>
                    <input type="text" required maxLength={3} value={form.countryCode} onChange={e => setForm(p => ({ ...p, countryCode: e.target.value.toUpperCase() }))} placeholder="e.g. LB" className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Flag Emoji</label>
                    <input type="text" value={form.flag} onChange={e => setForm(p => ({ ...p, flag: e.target.value }))} placeholder="e.g. 🇱🇧" className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Working Hours/Day</label>
                    <input type="number" min={1} max={24} value={form.workingHoursPerDay} onChange={e => setForm(p => ({ ...p, workingHoursPerDay: Number(e.target.value) }))} className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Default Approval Workflow</label>
                    <select value={form.approvalWorkflow} onChange={e => setForm(p => ({ ...p, approvalWorkflow: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {state.approvalLevels.map(lvl => (
                        <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Division Assignment</label>
                    <input type="text" value={form.divisionAssignment || ''} onChange={e => setForm(p => ({ ...p, divisionAssignment: e.target.value }))} placeholder="e.g. Levant, Europe" className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Weekend Days</label>
                  <div className="flex flex-wrap gap-2">
                    {dayNames.map((name, idx) => {
                      const selected = form.weekendDays.includes(idx);
                      return (
                        <button key={idx} type="button" onClick={() => handleWeekendToggle(idx)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${selected ? 'bg-violet-600 border-violet-600 text-white' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
                          {name.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ─── LEAVE QUOTAS TAB ─── */}
            {activeTab === 'quotas' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                
                {/* Leave type list */}
                <div className="md:col-span-1 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                  {allLeaveTypes.map((lt, idx) => {
                    const hasRule = form.leaveQuotas.some(q => q.leaveType === lt.key);
                    return (
                      <button key={lt.key} type="button" onClick={() => setSelectedQuotaIndex(idx)} className={`w-full text-left px-3 py-3 text-xs font-bold flex justify-between items-center transition-colors cursor-pointer ${selectedQuotaIndex === idx ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800'}`}>
                        <span>{lt.label}</span>
                        {hasRule && <span className="w-2 h-2 rounded-full bg-violet-600"></span>}
                      </button>
                    );
                  })}
                </div>

                {/* Form fields for active leave type */}
                <div className="md:col-span-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-700 pb-2">
                    <h3 className="font-bold text-slate-800 dark:text-white capitalize text-sm">{form.leaveQuotas[selectedQuotaIndex].leaveType.replace('_', ' ')} Leave Rules</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Entitlement (Days/Year)</label>
                      <input type="number" min={0} value={form.leaveQuotas[selectedQuotaIndex].entitlementDays} onChange={e => handleQuotaChange(selectedQuotaIndex, 'entitlementDays', Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Accrual Interval</label>
                      <select value={form.leaveQuotas[selectedQuotaIndex].accrualInterval || 'yearly'} onChange={e => handleQuotaChange(selectedQuotaIndex, 'accrualInterval', e.target.value as any)} className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500">
                        <option value="yearly">Yearly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>

                  {/* Accrued logic checkbox */}
                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Is Accrued Leave</span>
                      <span className="text-[10px] text-slate-400">Earn leave days incrementally over time</span>
                    </div>
                    <input type="checkbox" checked={form.leaveQuotas[selectedQuotaIndex].isAccrued} onChange={e => handleQuotaChange(selectedQuotaIndex, 'isAccrued', e.target.checked)} className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer" />
                  </div>

                  {form.leaveQuotas[selectedQuotaIndex].isAccrued && (
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Accrual Rate (Days/Period) *</label>
                      <input type="number" step="0.01" min={0} value={form.leaveQuotas[selectedQuotaIndex].accrualRate || 0} onChange={e => handleQuotaChange(selectedQuotaIndex, 'accrualRate', Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                      <p className="text-[9px] text-slate-400 mt-1">Numeric value of days earned per accrual interval.</p>
                      {errors[`quota_${selectedQuotaIndex}_rate`] && <p className="text-red-500 text-[9px] mt-1">{errors[`quota_${selectedQuotaIndex}_rate`]}</p>}
                    </div>
                  )}

                  {/* Seniority Milestones List */}
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Seniority Milestones</span>
                        <p className="text-[10px] text-slate-400">Award extra days based on years of service</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const currentMilestones = form.leaveQuotas[selectedQuotaIndex].seniorityMilestones || [];
                          handleQuotaChange(selectedQuotaIndex, 'seniorityMilestones', [...currentMilestones, { years: 1, accruedDays: 1 }]);
                        }}
                        className="px-2 py-1 text-[10px] font-bold text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded border border-violet-200 dark:border-violet-700 cursor-pointer flex items-center gap-1"
                      >
                        <Plus size={10} /> Add Milestone
                      </button>
                    </div>

                    {(form.leaveQuotas[selectedQuotaIndex].seniorityMilestones || []).length > 0 ? (
                      <div className="space-y-2">
                        {(form.leaveQuotas[selectedQuotaIndex].seniorityMilestones || []).map((milestone, mIdx) => (
                          <div key={mIdx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200/50 dark:border-slate-805">
                            <div className="flex-1 flex items-center gap-1.5">
                              <span className="text-[9px] text-slate-400">After</span>
                              <input
                                type="number"
                                min={0}
                                value={milestone.years}
                                onChange={e => {
                                  const nextM = [...(form.leaveQuotas[selectedQuotaIndex].seniorityMilestones || [])];
                                  nextM[mIdx] = { ...nextM[mIdx], years: Number(e.target.value) };
                                  handleQuotaChange(selectedQuotaIndex, 'seniorityMilestones', nextM);
                                }}
                                className="w-12 px-1.5 py-0.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-650 rounded text-center focus:ring-1 focus:ring-violet-500 text-slate-700 dark:text-slate-205"
                              />
                              <span className="text-[9px] text-slate-400">years, earn</span>
                              <input
                                type="number"
                                min={0}
                                value={milestone.accruedDays}
                                onChange={e => {
                                  const nextM = [...(form.leaveQuotas[selectedQuotaIndex].seniorityMilestones || [])];
                                  nextM[mIdx] = { ...nextM[mIdx], accruedDays: Number(e.target.value) };
                                  handleQuotaChange(selectedQuotaIndex, 'seniorityMilestones', nextM);
                                }}
                                className="w-12 px-1.5 py-0.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-650 rounded text-center focus:ring-1 focus:ring-violet-500 text-slate-700 dark:text-slate-205"
                              />
                              <span className="text-[9px] text-slate-400">extra days</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const nextM = (form.leaveQuotas[selectedQuotaIndex].seniorityMilestones || []).filter((_, i) => i !== mIdx);
                                handleQuotaChange(selectedQuotaIndex, 'seniorityMilestones', nextM);
                              }}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No milestones defined.</p>
                    )}
                  </div>

                  {/* Cut-off Rule */}
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Different Cut-off Date</span>
                        <span className="text-[10px] text-slate-400">Is the cut-off date different from hiring date?</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!form.leaveQuotas[selectedQuotaIndex].isCutOffDifferentFromHireDate}
                        onChange={e => {
                          handleQuotaChange(selectedQuotaIndex, 'isCutOffDifferentFromHireDate', e.target.checked);
                          if (!e.target.checked) {
                            handleQuotaChange(selectedQuotaIndex, 'cutOffDate', '');
                          }
                        }}
                        className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
                      />
                    </div>

                    {form.leaveQuotas[selectedQuotaIndex].isCutOffDifferentFromHireDate && (
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Cut-Off Date (MM-DD) *</label>
                        <input
                          type="text"
                          placeholder="e.g. 12-31"
                          required
                          value={form.leaveQuotas[selectedQuotaIndex].cutOffDate || ''}
                          onChange={e => handleQuotaChange(selectedQuotaIndex, 'cutOffDate', e.target.value)}
                          className={`w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border ${errors[`quota_${selectedQuotaIndex}_cutoff`] ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none`}
                        />
                        {errors[`quota_${selectedQuotaIndex}_cutoff`] && <p className="text-red-500 text-[9px] mt-1">{errors[`quota_${selectedQuotaIndex}_cutoff`]}</p>}
                      </div>
                    )}
                  </div>

                  {/* Reset & Expiry */}
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Reset Rules</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Reset Date (MM-DD)</label>
                        <input
                          type="text"
                          placeholder="e.g. 01-01"
                          value={form.leaveQuotas[selectedQuotaIndex].resetDate || ''}
                          onChange={e => handleQuotaChange(selectedQuotaIndex, 'resetDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none"
                        />
                        <p className="text-[8px] text-slate-400 mt-0.5">When new balances are granted.</p>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Number of Reset Days</label>
                        <input
                          type="number"
                          min={0}
                          value={form.leaveQuotas[selectedQuotaIndex].resetDaysCount || 0}
                          onChange={e => handleQuotaChange(selectedQuotaIndex, 'resetDaysCount', Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none"
                        />
                        <p className="text-[8px] text-slate-400 mt-0.5">Days to reset after the cut-off period.</p>
                      </div>
                    </div>
                  </div>

                  {/* Carry Over fields */}
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Carry-Over Enabled</span>
                        <span className="text-[10px] text-slate-400">Transfer unused days to next reset period</span>
                      </div>
                      <input type="checkbox" checked={form.leaveQuotas[selectedQuotaIndex].carryOverEnabled} onChange={e => {
                        handleQuotaChange(selectedQuotaIndex, 'carryOverEnabled', e.target.checked);
                        if (!e.target.checked) {
                          handleQuotaChange(selectedQuotaIndex, 'maxCarryOver', 0);
                          handleQuotaChange(selectedQuotaIndex, 'carryOverExpiration', '');
                        }
                      }} className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer" />
                    </div>

                    {form.leaveQuotas[selectedQuotaIndex].carryOverEnabled && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Max Carry-Over Days</label>
                          <input type="number" min={0} value={form.leaveQuotas[selectedQuotaIndex].maxCarryOver} onChange={e => handleQuotaChange(selectedQuotaIndex, 'maxCarryOver', Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none" />
                          {errors[`quota_${selectedQuotaIndex}_carry`] && <p className="text-red-500 text-[9px] mt-1">{errors[`quota_${selectedQuotaIndex}_carry`]}</p>}
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Carry-Over Expiration Date/Period</label>
                          <input type="text" placeholder="e.g. 03-31 or 3 months" value={form.leaveQuotas[selectedQuotaIndex].carryOverExpiration || ''} onChange={e => handleQuotaChange(selectedQuotaIndex, 'carryOverExpiration', e.target.value)} className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none" />
                          <p className="text-[8px] text-slate-400 mt-0.5">When carried days expire.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions footer */}
          <div className="flex gap-3 p-6 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors cursor-pointer">{editPol ? 'Save Policy' : 'Create Policy'}</button>
          </div>
        </form>
      </SlideDrawer>

      {/* Delete confirm dialog */}
      <ConfirmModal 
        isOpen={deleteId !== null} 
        onClose={() => setDeleteId(null)} 
        onConfirm={() => {
          if (deleteId) {
            dispatch({ type: 'DELETE_POLICY', payload: deleteId });
            setDeleteId(null);
          }
        }} 
        title="Delete Policy" 
        message={`Are you sure you want to permanently delete this leave policy? This action cannot be undone and will affect employees associated with it.`} 
        confirmLabel="Delete" 
        danger 
      />
    </div>
  );
}
