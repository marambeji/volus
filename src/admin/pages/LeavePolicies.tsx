import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, RefreshCw, Eye, FileText } from 'lucide-react';
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

const defaultQuotaForType = (typeKey: string, typeId?: string): LeaveQuota => {
  const keyLower = typeKey.toLowerCase();
  const isAccruedDefault = keyLower === 'annual' || keyLower === 'compensation' || keyLower === 'overtime';
  return {
    leaveTypeId: typeId,
    leaveType: typeKey as LeaveTypeKey,
    entitlementDays: keyLower === 'annual' ? 25 : keyLower === 'sick' ? 10 : keyLower === 'unpaid' ? 30 : 10,
    isAccrued: isAccruedDefault,
    accrualRate: isAccruedDefault ? 2.08 : 0,
    accrualInterval: 'monthly',
    carryOverEnabled: keyLower === 'annual',
    maxCarryOver: keyLower === 'annual' ? 5 : 0,
    maxConsecutive: keyLower === 'sick' ? 5 : 10,
    maxConsecutiveDays: keyLower === 'sick' ? 5 : 10,
    minNoticeDays: keyLower === 'annual' ? 2 : 0,
    seniorityMilestones: [],
    isCutOffDifferentFromHireDate: false,
    cutOffDate: '',
    carryOverExpiration: '',
    maxBalanceCap: null,
    resetDate: '01-01',
    resetDaysCount: 0,
    waitingPeriodDays: 0,
    allowsHalfDay: keyLower === 'annual' || keyLower === 'compensation',
    requiresNote: keyLower === 'sick' || keyLower === 'bereavement' || keyLower === 'wedding' || keyLower === 'unpaid',
    requiresDocument: keyLower === 'sick' || keyLower === 'maternity' || keyLower === 'paternity',
    requiresPositiveBalance: keyLower !== 'unpaid' && keyLower !== 'sick',
    minRequestDays: 0.5,
    maxRequestDays: null,
    allowedCountries: null,
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
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [editPol, setEditPol] = useState<CountryPolicy | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form Base State
  const [policyName, setPolicyName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [countryName, setCountryName] = useState('');
  const [flag, setFlag] = useState('🏳️');
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState(8);
  const [approvalWorkflow, setApprovalWorkflow] = useState('');
  const [divisionAssignment, setDivisionAssignment] = useState('');
  const [weekendDays, setWeekendDays] = useState<number[]>([0, 6]);

  // Quota Form State per LeaveType (indexed by stable leaveTypeId or key)
  const [quotasByTypeId, setQuotasByTypeId] = useState<Record<string, LeaveQuota>>({});
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'general' | 'quotas'>('general');
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

  const activeLeaveTypes = leaveTypes.filter(
    (lt) =>
      !lt.key.toLowerCase().startsWith('e2e') &&
      !lt.label.toLowerCase().startsWith('e2e')
  );

  function initializeQuotasState(existingQuotas: LeaveQuota[] = []): Record<string, LeaveQuota> {
    const map: Record<string, LeaveQuota> = {};
    const typesToUse = activeLeaveTypes.length > 0
      ? activeLeaveTypes
      : [
          { id: 'lt-annual', key: 'annual', label: 'Annual Leave' },
          { id: 'lt-sick', key: 'sick', label: 'Sick Leave' },
          { id: 'lt-unpaid', key: 'unpaid', label: 'Unpaid Leave' },
        ];

    typesToUse.forEach((lt) => {
      const keyOrId = lt.id || lt.key;
      const existing = existingQuotas.find(
        (q) => (q.leaveTypeId && q.leaveTypeId === lt.id) || q.leaveType === lt.key || q.leaveType === lt.id
      );

      if (existing) {
        map[keyOrId] = {
          ...defaultQuotaForType(lt.key, lt.id),
          ...existing,
          leaveTypeId: lt.id || existing.leaveTypeId,
          leaveType: lt.key,
        };
      } else {
        map[keyOrId] = defaultQuotaForType(lt.key, lt.id);
      }
    });

    return map;
  }

  function openAdd() {
    const firstC = countries[0];
    const firstWf = workflows[0];
    setPolicyName('');
    setCountryCode(firstC?.code || 'LB');
    setCountryName(firstC?.name || 'Lebanon');
    setFlag(firstC?.flag || '🇱🇧');
    setWorkingHoursPerDay(8);
    setApprovalWorkflow(firstWf?.id || '');
    setDivisionAssignment('');
    setWeekendDays([0, 6]);

    const initialQuotas = initializeQuotasState([]);
    setQuotasByTypeId(initialQuotas);

    const firstTypeId = Object.keys(initialQuotas)[0] || '';
    setSelectedLeaveTypeId(firstTypeId);

    setEditPol(null);
    setIsViewOnly(false);
    setActiveTab('general');
    setErrors({});
    setFormOpen(true);
  }

  function populatePolicyData(policy: CountryPolicy) {
    setPolicyName(policy.policyName);
    setCountryCode(policy.countryCode);
    setCountryName(policy.country);
    setFlag(policy.flag);
    setWorkingHoursPerDay(policy.workingHoursPerDay);
    setApprovalWorkflow(policy.approvalWorkflow);
    setDivisionAssignment(policy.divisionAssignment || '');
    setWeekendDays(policy.weekendDays || [0, 6]);

    const initialQuotas = initializeQuotasState(policy.leaveQuotas || []);
    setQuotasByTypeId(initialQuotas);

    const firstTypeId = Object.keys(initialQuotas)[0] || '';
    setSelectedLeaveTypeId(firstTypeId);

    setEditPol(policy);
    setActiveTab('general');
    setErrors({});
  }

  function openView(policy: CountryPolicy) {
    populatePolicyData(policy);
    setIsViewOnly(true);
    setFormOpen(true);
  }

  function openEdit(policy: CountryPolicy) {
    populatePolicyData(policy);
    setIsViewOnly(false);
    setFormOpen(true);
  }

  function handleCountrySelect(cCode: string) {
    const found = countries.find((c) => c.code === cCode);
    if (found) {
      setCountryCode(found.code);
      setCountryName(found.name);
      setFlag(found.flag);
    }
  }

  function handleWeekendToggle(dayIndex: number) {
    if (isViewOnly) return;
    const isWeekend = weekendDays.includes(dayIndex);
    const nextWeekend = isWeekend
      ? weekendDays.filter((d) => d !== dayIndex)
      : [...weekendDays, dayIndex].sort();
    setWeekendDays(nextWeekend);
  }

  function handleCurrentQuotaChange<K extends keyof LeaveQuota>(key: K, val: LeaveQuota[K]) {
    if (isViewOnly || !selectedLeaveTypeId) return;
    setQuotasByTypeId((prev) => ({
      ...prev,
      [selectedLeaveTypeId]: {
        ...prev[selectedLeaveTypeId],
        [key]: val,
      },
    }));
  }

  function handleMilestoneChange(key: 'years' | 'accruedDays', val: number) {
    if (isViewOnly || !selectedLeaveTypeId) return;
    const current = quotasByTypeId[selectedLeaveTypeId];
    const ms = [...(current?.seniorityMilestones || [])];
    if (ms.length === 0) ms.push({ years: 0, accruedDays: 0 });
    ms[0] = { ...ms[0], [key]: val };
    handleCurrentQuotaChange('seniorityMilestones', ms);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!policyName.trim()) newErrors.policyName = 'Policy Name is required';
    if (!countryCode.trim()) newErrors.countryCode = 'Country selection is required';
    if (!approvalWorkflow.trim()) newErrors.approvalWorkflow = 'Approval Workflow selection is required';

    Object.values(quotasByTypeId).forEach((q) => {
      if (q.isAccrued && (q.accrualRate ?? 0) <= 0) {
        newErrors[`quota_${q.leaveType}_rate`] = `Accrual rate for ${q.leaveType} must be positive`;
      }
      if (q.carryOverEnabled && (q.maxCarryOver ?? 0) < 0) {
        newErrors[`quota_${q.leaveType}_carry`] = `Max carry over for ${q.leaveType} cannot be negative`;
      }
      if (q.isCutOffDifferentFromHireDate && !q.cutOffDate?.trim()) {
        newErrors[`quota_${q.leaveType}_cutoff`] = `Cut-off date for ${q.leaveType} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isViewOnly) return;
    if (!validate()) return;

    setSaving(true);
    const finalQuotas = Object.values(quotasByTypeId);
    const payload: Partial<CountryPolicy> = {
      id: editPol?.id,
      policyName: policyName.trim(),
      countryCode,
      country: countryName,
      flag,
      workingHoursPerDay,
      approvalWorkflow,
      divisionAssignment,
      weekendDays,
      leaveQuotas: finalQuotas,
    };

    try {
      if (editPol && editPol.id) {
        await updatePolicy(editPol.id, payload);
      } else {
        await createPolicy(payload);
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

  const currentQuota = quotasByTypeId[selectedLeaveTypeId];

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
              onClick={() => openView(policy)}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between hover:border-violet-400 hover:shadow-md transition-all cursor-pointer group"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{policy.flag}</span>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-white text-base group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{policy.policyName}</h3>
                      <p className="text-xs text-slate-500">
                        {policy.country} · {policy.countryCode}{' '}
                        {policy.divisionAssignment ? `· ${policy.divisionAssignment}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openView(policy);
                      }}
                      className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-violet-600 rounded-xl transition-colors cursor-pointer"
                      title="Consult Details (Slide Drawer)"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(policy);
                      }}
                      className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-violet-600 rounded-xl transition-colors cursor-pointer"
                      title="Edit Policy"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(policy.id);
                      }}
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

      {/* Details & Form Drawer */}
      <SlideDrawer
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={isViewOnly ? 'Policy Details' : editPol ? 'Edit Policy' : 'Add Policy'}
        subtitle={isViewOnly ? `Consulting ${editPol?.policyName || 'Policy Details'}` : editPol ? `Modifying ${editPol.policyName}` : 'Create a new country leave policy'}
      >
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6 h-full">
          {errors.form && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 dark:text-red-300 rounded-xl text-xs flex items-center gap-1.5">
              <AlertCircle size={14} /> {errors.form}
            </div>
          )}

          {/* Form Tabs */}
          <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex-1 py-2.5 px-4 text-xs font-black rounded-xl transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700'
              }`}
            >
              General Settings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('quotas')}
              className={`flex-1 py-2.5 px-4 text-xs font-black rounded-xl transition-all cursor-pointer ${
                activeTab === 'quotas'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700'
              }`}
            >
              Leave Rules & Quotas ({Object.keys(quotasByTypeId).length})
            </button>
          </div>

          {activeTab === 'general' ? (
            isViewOnly ? (
              /* READ-ONLY CONSULTATION DISPLAY FOR GENERAL SETTINGS */
              <div className="space-y-4 py-2">
                <div className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Policy Name
                  </span>
                  <p className="text-lg font-black text-slate-800 dark:text-white">
                    {policyName || 'Unnamed Policy'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                      Country
                    </span>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <span className="text-2xl">{flag}</span> {countryName} ({countryCode})
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                      Working Hours / Day
                    </span>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {workingHoursPerDay} hrs/day
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                      Approval Workflow
                    </span>
                    <p className="text-sm font-bold text-violet-600 dark:text-violet-400">
                      {workflows.find((w) => w.id === approvalWorkflow)?.name || 'Standard Approval'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                      Division Assignment
                    </span>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {divisionAssignment || 'None (All Divisions)'}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                    Weekend Days
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {dayNames.map((name, idx) => {
                      const isSelected = weekendDays.includes(idx);
                      return (
                        <span
                          key={idx}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                            isSelected
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'bg-slate-200/60 dark:bg-slate-700 text-slate-500'
                          }`}
                        >
                          {name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* EDITABLE FORM INPUTS FOR GENERAL SETTINGS */
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Policy Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Standard Global Leave Policy"
                    value={policyName}
                    onChange={(e) => setPolicyName(e.target.value)}
                    className={`w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                      errors.policyName ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                    }`}
                  />
                  {errors.policyName && <span className="text-[10px] text-red-500 mt-1 block">{errors.policyName}</span>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Country *
                    </label>
                    <select
                      value={countryCode}
                      onChange={(e) => handleCountrySelect(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      {countries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name} ({c.code})
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
                      value={workingHoursPerDay}
                      onChange={(e) => setWorkingHoursPerDay(Number(e.target.value))}
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
                      value={approvalWorkflow}
                      onChange={(e) => setApprovalWorkflow(e.target.value)}
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
                      value={divisionAssignment}
                      onChange={(e) => setDivisionAssignment(e.target.value)}
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
                      const isSelected = weekendDays.includes(idx);
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
            )
          ) : (
            isViewOnly ? (
              /* READ-ONLY CONSULTATION DISPLAY LISTING ALL 10 LEAVE RULES IN SLIDE DRAWER */
              <div className="space-y-4 overflow-y-auto pr-1">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} className="text-violet-600 dark:text-violet-400" />
                    All Configured Leave Rules ({Object.keys(quotasByTypeId).length})
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-full uppercase">
                    Read-Only View
                  </span>
                </div>

                <div className="space-y-4">
                  {Object.keys(quotasByTypeId).map((typeIdKey) => {
                    const q = quotasByTypeId[typeIdKey];
                    const ltItem = activeLeaveTypes.find((t) => t.id === typeIdKey || t.key === typeIdKey);
                    const displayLabel = ltItem?.label || q.leaveType;

                    return (
                      <div
                        key={typeIdKey}
                        className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-600/60 pb-2">
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-white capitalize">
                            {displayLabel}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2.5 py-1 rounded-lg">
                              {q.entitlementDays} days / yr
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-200/60 dark:bg-slate-600 px-2 py-1 rounded-lg">
                              {q.isAccrued ? `Accrued (${q.accrualRate}d/${q.accrualInterval || 'mo'})` : 'Frontloaded'}
                            </span>
                          </div>
                        </div>

                        {/* Rules Badges */}
                        <div className="flex flex-wrap gap-1.5 text-[10px] font-extrabold">
                          <span className={`px-2 py-0.5 rounded ${q.allowsHalfDay ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            {q.allowsHalfDay ? '✓ Half Day' : '✕ No Half Day'}
                          </span>
                          <span className={`px-2 py-0.5 rounded ${q.requiresPositiveBalance ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>
                            {q.requiresPositiveBalance ? '✓ Positive Balance' : '⚠ Negative Allowed'}
                          </span>
                          <span className={`px-2 py-0.5 rounded ${q.requiresNote ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                            {q.requiresNote ? '✓ Reason Req.' : '✕ Reason Optional'}
                          </span>
                          <span className={`px-2 py-0.5 rounded ${q.requiresDocument ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-400'}`}>
                            {q.requiresDocument ? '✓ Document Req.' : '✕ Document Optional'}
                          </span>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block font-bold">Max Consecutive</span>
                            <strong>{q.maxConsecutiveDays ?? q.maxConsecutive ?? 'Unlimited'} days</strong>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block font-bold">Min / Max Request</span>
                            <strong>{q.minRequestDays ?? 0.5}d - {q.maxRequestDays ?? '∞'}</strong>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block font-bold">Carry Over</span>
                            <strong>{q.carryOverEnabled ? `Max ${q.maxCarryOver}d` : 'Disabled'}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* EDITABLE FORM INPUTS FOR LEAVE RULES & QUOTAS */
              <div className="flex gap-4 flex-1 overflow-hidden min-h-96">
                {/* Leave Types Sub-sidebar */}
                <div className="w-1/3 border-r border-slate-100 dark:border-slate-700 pr-3 space-y-1 overflow-y-auto">
                  {Object.keys(quotasByTypeId).map((typeIdKey) => {
                    const quota = quotasByTypeId[typeIdKey];
                    const ltItem = activeLeaveTypes.find((t) => t.id === typeIdKey || t.key === typeIdKey);
                    const displayLabel = ltItem?.label || quota.leaveType;
                    const isSelected = selectedLeaveTypeId === typeIdKey;

                    return (
                      <button
                        type="button"
                        key={typeIdKey}
                        onClick={() => setSelectedLeaveTypeId(typeIdKey)}
                        className={`w-full text-left p-2.5 rounded-xl text-xs font-bold flex justify-between items-center transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        <span className="capitalize truncate pr-1">{displayLabel}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono flex-shrink-0">
                          {quota.entitlementDays}d
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Leave Type Rule Details */}
                {currentQuota ? (
                  <div className="w-2/3 space-y-4 overflow-y-auto pl-1 pr-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white capitalize">
                        {activeLeaveTypes.find(t => t.id === selectedLeaveTypeId || t.key === selectedLeaveTypeId)?.label || currentQuota.leaveType} Rules
                      </h4>
                    </div>

                    {/* Core Duration Rules */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                          Entitlement Days / Year
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={currentQuota.entitlementDays ?? 0}
                          onChange={(e) => handleCurrentQuotaChange('entitlementDays', Math.max(0, Number(e.target.value)))}
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
                          value={currentQuota.maxConsecutiveDays ?? currentQuota.maxConsecutive ?? 0}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            handleCurrentQuotaChange('maxConsecutiveDays', val);
                            handleCurrentQuotaChange('maxConsecutive', val);
                          }}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>

                    {/* Accruals Toggle & Conditional Fields */}
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Enable Accruals
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(currentQuota.isAccrued)}
                        onChange={(e) => handleCurrentQuotaChange('isAccrued', e.target.checked)}
                        className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
                      />
                    </div>

                    {currentQuota.isAccrued && (
                      <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-violet-500 space-y-1">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                            Accrual Interval
                          </label>
                          <select
                            value={currentQuota.accrualInterval || 'monthly'}
                            onChange={(e) => handleCurrentQuotaChange('accrualInterval', e.target.value as 'monthly' | 'yearly')}
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
                            value={currentQuota.accrualRate || 0}
                            onChange={(e) => handleCurrentQuotaChange('accrualRate', Math.max(0, Number(e.target.value)))}
                            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                            Seniority Milestone (Years)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={currentQuota.seniorityMilestones?.[0]?.years || 0}
                            onChange={(e) => handleMilestoneChange('years', Math.max(0, Number(e.target.value)))}
                            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                            Milestone Accrued Days
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentQuota.seniorityMilestones?.[0]?.accruedDays || 0}
                            onChange={(e) => handleMilestoneChange('accruedDays', Math.max(0, Number(e.target.value)))}
                            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Limits & Durations */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                          Cap (Max Balance)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={currentQuota.maxBalanceCap ?? ''}
                          placeholder="Unlimited"
                          onChange={(e) => handleCurrentQuotaChange('maxBalanceCap', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                          Waiting Period in Days
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={currentQuota.waitingPeriodDays ?? 0}
                          onChange={(e) => handleCurrentQuotaChange('waitingPeriodDays', Math.max(0, Number(e.target.value)))}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                          Min Request Days
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={currentQuota.minRequestDays ?? 0.5}
                          onChange={(e) => handleCurrentQuotaChange('minRequestDays', Math.max(0.5, Number(e.target.value)))}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                          Max Request Days
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={currentQuota.maxRequestDays ?? ''}
                          placeholder="No Maximum"
                          onChange={(e) => handleCurrentQuotaChange('maxRequestDays', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>

                    {/* Checkbox Rules Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(currentQuota.allowsHalfDay)}
                          onChange={(e) => handleCurrentQuotaChange('allowsHalfDay', e.target.checked)}
                          className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
                        />
                        Allows Half Day
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(currentQuota.requiresPositiveBalance)}
                          onChange={(e) => handleCurrentQuotaChange('requiresPositiveBalance', e.target.checked)}
                          className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
                        />
                        Requires Positive Balance
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(currentQuota.requiresNote)}
                          onChange={(e) => handleCurrentQuotaChange('requiresNote', e.target.checked)}
                          className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
                        />
                        Requires Note
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(currentQuota.requiresDocument)}
                          onChange={(e) => handleCurrentQuotaChange('requiresDocument', e.target.checked)}
                          className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
                        />
                        Requires Supporting Document
                      </label>
                    </div>

                    {/* Cut-Off Date Section */}
                    <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Is cut off day different than hiring date?
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(currentQuota.isCutOffDifferentFromHireDate)}
                          onChange={(e) => handleCurrentQuotaChange('isCutOffDifferentFromHireDate', e.target.checked)}
                          className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
                        />
                      </div>
                      {currentQuota.isCutOffDifferentFromHireDate && (
                        <div className="mt-2">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                            Cut-Off Date (MM-DD)
                          </label>
                          <input
                            type="text"
                            placeholder="01-01"
                            value={currentQuota.cutOffDate || ''}
                            onChange={(e) => handleCurrentQuotaChange('cutOffDate', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Carry Over Section */}
                    <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Can unused time off be carried over?
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(currentQuota.carryOverEnabled)}
                          onChange={(e) => handleCurrentQuotaChange('carryOverEnabled', e.target.checked)}
                          className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
                        />
                      </div>
                      {currentQuota.carryOverEnabled && (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                              Max Carry Over Days
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={currentQuota.maxCarryOver ?? 0}
                              onChange={(e) => handleCurrentQuotaChange('maxCarryOver', Math.max(0, Number(e.target.value)))}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                              Reset Days Count
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={currentQuota.resetDaysCount ?? 0}
                              onChange={(e) => handleCurrentQuotaChange('resetDaysCount', Math.max(0, Number(e.target.value)))}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-2/3 flex items-center justify-center text-slate-400 text-xs">
                    Select a leave type from the list to configure its rules.
                  </div>
                )}
              </div>
            )
          )}

          <div className="flex gap-3 pt-4 mt-auto border-t border-slate-100 dark:border-slate-700">
            {isViewOnly ? (
              <>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setIsViewOnly(false)}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-violet-600 rounded-xl hover:bg-violet-700 cursor-pointer flex justify-center items-center gap-2"
                >
                  <Edit2 size={14} /> Edit Policy
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
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
