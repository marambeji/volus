import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import type { CountryPolicy, LeaveQuota } from '../types/adminTypes';
import type { LeaveTypeKey } from '../../types';
import SearchInput from '../components/ui/SearchInput';
import SlideDrawer from '../components/ui/SlideDrawer';
import ConfirmModal from '../components/ui/ConfirmModal';
import { getCountries } from '../../services/countriesApi';
import type { CountryItem } from '../../services/countriesApi';
import { getDivisions } from '../../services/divisionsApi';
import type { DivisionItem } from '../../services/divisionsApi';
import { getLeaveTypes } from '../../services/leaveTypesApi';
import type { LeaveTypeItem } from '../../services/leaveTypesApi';
import { getApprovalWorkflows } from '../../services/approvalWorkflowsApi';
import {
  getPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
} from '../../services/policiesApi';
import { ApiError } from '../../services/apiClient';
import type { ApprovalConfiguration } from '../types/adminTypes';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  waitingPeriodDays: 0,
});

const emptyForm = (
  defaultCountryCode = '',
  defaultCountryName = '',
  defaultFlag = '🏳️',
  defaultWorkflowId = '',
  leaveTypes: LeaveTypeItem[] = []
): Omit<CountryPolicy, 'id'> & { id?: string } => {
  const quotas = leaveTypes.map((lt) => defaultQuota(lt.key as LeaveTypeKey));
  return {
    policyName: '',
    country: defaultCountryName,
    countryCode: defaultCountryCode,
    flag: defaultFlag,
    weekendDays: [0, 6],
    workingHoursPerDay: 8,
    approvalWorkflow: defaultWorkflowId,
    leaveQuotas: quotas.length > 0 ? quotas : [defaultQuota('annual')],
    divisionAssignment: '',
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
  };
};

export default function LeavePolicies() {
  const [policies, setPolicies] = useState<CountryPolicy[]>([]);
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [divisions, setDivisions] = useState<DivisionItem[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [workflows, setWorkflows] = useState<ApprovalConfiguration[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editPol, setEditPol] = useState<CountryPolicy | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState<Omit<CountryPolicy, 'id'> & { id?: string }>(emptyForm());
  const [activeTab, setActiveTab] = useState<'general' | 'quotas'>('general');
  const [selectedQuotaIndex, setSelectedQuotaIndex] = useState<number>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = async (signal?: AbortSignal) => {
    setLoading(true);
    setApiError(null);
    try {
      const [cRes, dRes, ltRes, wfRes, pRes] = await Promise.all([
        getCountries(signal),
        getDivisions(signal),
        getLeaveTypes(signal),
        getApprovalWorkflows(signal),
        getPolicies(signal),
      ]);

      setCountries(cRes);
      setDivisions(dRes);
      setLeaveTypes(ltRes);
      setWorkflows(wfRes);
      setPolicies(pRes);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Failed to load policy configuration data';
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, []);

  const filtered = policies.filter(
    (p) =>
      p.policyName.toLowerCase().includes(search.toLowerCase()) ||
      p.country.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    const firstC = countries[0];
    const firstWf = workflows[0];
    setForm(
      emptyForm(
        firstC?.code || 'LB',
        firstC?.name || 'Lebanon',
        firstC?.flag || '🇱🇧',
        firstWf?.id || '',
        leaveTypes
      )
    );
    setEditPol(null);
    setActiveTab('general');
    setSelectedQuotaIndex(0);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(policy: CountryPolicy) {
    const availableLeaveTypes =
      leaveTypes.length > 0
        ? leaveTypes
        : [
            { key: 'annual', label: 'Annual' },
            { key: 'sick', label: 'Sick' },
          ];

    setForm({
      ...policy,
      leaveQuotas: availableLeaveTypes.map((lt) => {
        const existing = policy.leaveQuotas.find((q) => q.leaveType === lt.key);
        return existing
          ? { ...defaultQuota(lt.key as LeaveTypeKey), ...existing }
          : defaultQuota(lt.key as LeaveTypeKey);
      }),
    });
    setEditPol(policy);
    setActiveTab('general');
    setSelectedQuotaIndex(0);
    setErrors({});
    setFormOpen(true);
  }

  function handleCountrySelect(countryCode: string) {
    const found = countries.find((c) => c.code === countryCode);
    if (found) {
      setForm((p) => ({
        ...p,
        countryCode: found.code,
        country: found.name,
        flag: found.flag,
      }));
    }
  }

  function handleWeekendToggle(dayIndex: number) {
    const isWeekend = form.weekendDays.includes(dayIndex);
    const nextWeekend = isWeekend
      ? form.weekendDays.filter((d) => d !== dayIndex)
      : [...form.weekendDays, dayIndex].sort();
    setForm((p) => ({ ...p, weekendDays: nextWeekend }));
  }

  function handleQuotaChange<K extends keyof LeaveQuota>(index: number, key: K, val: LeaveQuota[K]) {
    const nextQuotas = [...form.leaveQuotas];
    nextQuotas[index] = { ...nextQuotas[index], [key]: val };
    setForm((p) => ({ ...p, leaveQuotas: nextQuotas }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.policyName.trim()) newErrors.policyName = 'Policy Name is required';
    if (!form.countryCode.trim()) newErrors.countryCode = 'Country selection is required';
    if (!form.approvalWorkflow.trim()) newErrors.approvalWorkflow = 'Approval Workflow selection is required';

    form.leaveQuotas.forEach((q, idx) => {
      if (q.isAccrued && (q.accrualRate ?? 0) <= 0) {
        newErrors[`quota_${idx}_rate`] = 'Accrual rate must be positive';
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      if (editPol && form.id) {
        await updatePolicy(form.id, form);
      } else {
        await createPolicy(form);
      }
      setFormOpen(false);
      await loadData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const valMsgs = err.validationMessages;
        setErrors((prev) => ({
          ...prev,
          form: valMsgs.length > 0 ? valMsgs.join(' | ') : err.message,
        }));
      } else {
        const msg = err instanceof Error ? err.message : 'Save failed';
        setErrors((prev) => ({ ...prev, form: msg }));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setSaving(true);
    try {
      await deletePolicy(deleteId);
      setDeleteId(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Leave Policies</h1>
          <p className="text-slate-400 text-sm mt-1">Configure leave rules, accrual intervals, and weekends by country</p>
        </div>
        <button
          onClick={openAdd}
          disabled={Boolean(apiError) || loading}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
        >
          <Plus size={16} /> Add Policy
        </button>
      </div>

      {/* Backend error banner */}
      {apiError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span className="text-sm font-medium">{apiError}</span>
          </div>
          <button
            onClick={() => void loadData()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-800/40 text-red-800 dark:text-red-200 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Filter and search */}
      <div className="w-full sm:w-64">
        <SearchInput value={search} onChange={setSearch} placeholder="Search policies..." />
      </div>

      {/* Loading state */}
      {loading && !apiError && (
        <div className="py-16 text-center text-slate-400 text-sm flex justify-center items-center gap-2">
          <RefreshCw size={16} className="animate-spin text-violet-600" /> Loading policies...
        </div>
      )}

      {/* Grid of Policies */}
      {!loading && !apiError && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((policy) => (
            <div
              key={policy.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between hover:border-violet-300 transition-colors"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{policy.flag}</span>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-white text-base">{policy.policyName}</h3>
                      <p className="text-xs text-slate-500">
                        {policy.country} · {policy.countryCode}{' '}
                        {policy.divisionAssignment ? `· ${policy.divisionAssignment}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEdit(policy)}
                      className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-violet-600 rounded-xl transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteId(policy.id)}
                      className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md text-[10px] font-bold">
                    Weekends: {policy.weekendDays.map((d) => dayNames[d].slice(0, 3)).join(', ')}
                  </span>
                  <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md text-[10px] font-bold">
                    {policy.workingHoursPerDay} hrs/day
                  </span>
                  <span className="bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 px-2 py-1 rounded-md text-[10px] font-bold">
                    Workflow:{' '}
                    {workflows.find((w) => w.id === policy.approvalWorkflow)?.name ||
                      'Standard Approval'}
                  </span>
                </div>

                <div className="flex-1 space-y-2 mt-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Leave Quotas Overview
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {policy.leaveQuotas.slice(0, 4).map((q, i) => (
                      <div
                        key={i}
                        className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700 text-xs"
                      >
                        <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">
                          {q.leaveType}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {q.entitlementDays} days/yr · {q.isAccrued ? 'Accrued' : 'Frontloaded'}
                        </div>
                      </div>
                    ))}
                  </div>
                  {policy.leaveQuotas.length > 4 && (
                    <p className="text-[10px] text-slate-400 text-right pt-1">
                      +{policy.leaveQuotas.length - 4} more quotas configured
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 text-sm">No policies found</div>
          )}
        </div>
      )}

      {/* Form Drawer */}
      <SlideDrawer
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editPol ? 'Edit Policy' : 'Add Policy'}
        subtitle={editPol ? `Modifying ${editPol.policyName}` : 'Create a new country leave policy'}
      >
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6 h-full">
          {errors.form && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 dark:text-red-300 rounded-xl text-xs flex items-center gap-1.5">
              <AlertCircle size={14} /> {errors.form}
            </div>
          )}

          {/* Form Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`pb-3 px-4 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'general'
                  ? 'border-b-2 border-violet-600 text-violet-600 dark:text-violet-400'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              General Settings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('quotas')}
              className={`pb-3 px-4 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'quotas'
                  ? 'border-b-2 border-violet-600 text-violet-600 dark:text-violet-400'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Leave Quotas & Rules ({form.leaveQuotas.length})
            </button>
          </div>

          {activeTab === 'general' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Policy Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.policyName}
                  onChange={(e) => setForm((p) => ({ ...p, policyName: e.target.value }))}
                  placeholder="e.g. Lebanon Standard Leave Policy"
                  className={`w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border ${
                    errors.policyName ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                  } rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`}
                />
                {errors.policyName && (
                  <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> {errors.policyName}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Country *
                  </label>
                  <select
                    value={form.countryCode}
                    onChange={(e) => handleCountrySelect(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {countries.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.name} ({c.code}) {c.flag}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Working Hours / Day
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="24"
                    value={form.workingHoursPerDay}
                    onChange={(e) => setForm((p) => ({ ...p, workingHoursPerDay: Number(e.target.value) }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Approval Workflow *
                  </label>
                  <select
                    value={form.approvalWorkflow}
                    onChange={(e) => setForm((p) => ({ ...p, approvalWorkflow: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {workflows.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Division Assignment
                  </label>
                  <select
                    value={form.divisionAssignment || ''}
                    onChange={(e) => setForm((p) => ({ ...p, divisionAssignment: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">None (All Divisions)</option>
                    {divisions.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Weekend Days
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {dayNames.map((name, idx) => {
                    const isSelected = form.weekendDays.includes(idx);
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleWeekendToggle(idx)}
                        className={`py-2 text-xs font-bold rounded-xl border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {name.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 flex-1 overflow-hidden min-h-96">
              {/* Quota Type Selector Sub-sidebar */}
              <div className="w-1/3 border-r border-slate-100 dark:border-slate-700 pr-3 space-y-1 overflow-y-auto">
                {form.leaveQuotas.map((q, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setSelectedQuotaIndex(idx)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-bold flex justify-between items-center transition-colors cursor-pointer ${
                      selectedQuotaIndex === idx
                        ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="capitalize">{q.leaveType}</span>
                    <span className="text-[10px] opacity-75">{q.entitlementDays}d</span>
                  </button>
                ))}
              </div>

              {/* Selected Quota Editor */}
              {form.leaveQuotas[selectedQuotaIndex] && (
                <div className="w-2/3 space-y-4 overflow-y-auto pl-1 pr-2">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white capitalize">
                    {form.leaveQuotas[selectedQuotaIndex].leaveType} Leave Rules
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                        Entitlement Days / Year
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={form.leaveQuotas[selectedQuotaIndex].entitlementDays}
                        onChange={(e) =>
                          handleQuotaChange(selectedQuotaIndex, 'entitlementDays', Number(e.target.value))
                        }
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                        Max Consecutive Days
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={form.leaveQuotas[selectedQuotaIndex].maxConsecutive}
                        onChange={(e) =>
                          handleQuotaChange(selectedQuotaIndex, 'maxConsecutive', Number(e.target.value))
                        }
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Enable Accruals
                    </span>
                    <input
                      type="checkbox"
                      checked={form.leaveQuotas[selectedQuotaIndex].isAccrued}
                      onChange={(e) =>
                        handleQuotaChange(selectedQuotaIndex, 'isAccrued', e.target.checked)
                      }
                      className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
                    />
                  </div>

                  {form.leaveQuotas[selectedQuotaIndex].isAccrued && (
                    <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-violet-500">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                          Accrual Interval
                        </label>
                        <select
                          value={form.leaveQuotas[selectedQuotaIndex].accrualInterval || 'monthly'}
                          onChange={(e) =>
                            handleQuotaChange(
                              selectedQuotaIndex,
                              'accrualInterval',
                              e.target.value as 'monthly' | 'yearly'
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                          Accrual Rate (days)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.leaveQuotas[selectedQuotaIndex].accrualRate || 0}
                          onChange={(e) =>
                            handleQuotaChange(selectedQuotaIndex, 'accrualRate', Number(e.target.value))
                          }
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Enable Carry Over
                    </span>
                    <input
                      type="checkbox"
                      checked={form.leaveQuotas[selectedQuotaIndex].carryOverEnabled}
                      onChange={(e) =>
                        handleQuotaChange(selectedQuotaIndex, 'carryOverEnabled', e.target.checked)
                      }
                      className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
                    />
                  </div>

                  {form.leaveQuotas[selectedQuotaIndex].carryOverEnabled && (
                    <div className="pl-2 border-l-2 border-violet-500">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                        Max Carry Over Days
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={form.leaveQuotas[selectedQuotaIndex].maxCarryOver}
                        onChange={(e) =>
                          handleQuotaChange(selectedQuotaIndex, 'maxCarryOver', Number(e.target.value))
                        }
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 mt-auto border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-bold text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-50 cursor-pointer flex justify-center items-center gap-2"
            >
              {saving && <RefreshCw size={14} className="animate-spin" />}
              {editPol ? 'Save Changes' : 'Add Policy'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Policy"
        message="Are you sure you want to permanently delete this leave policy? This action cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
