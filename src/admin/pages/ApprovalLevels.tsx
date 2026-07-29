import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Shield, AlertCircle, RefreshCw, History } from 'lucide-react';
import type { ApprovalConfiguration, ApprovalLevel } from '../types/adminTypes';
import SearchInput from '../components/ui/SearchInput';
import SlideDrawer from '../components/ui/SlideDrawer';
import ConfirmModal from '../components/ui/ConfirmModal';
import HistoryDrawer from '../components/HistoryDrawer';
import {
  getApprovalWorkflows,
  createApprovalWorkflow,
  updateApprovalWorkflow,
  deleteApprovalWorkflow,
} from '../../services/approvalWorkflowsApi';
import { getCountries, type CountryItem } from '../../services/countriesApi';
import { getLeaveTypes, type LeaveTypeItem } from '../../services/leaveTypesApi';

import { ApiError } from '../../services/apiClient';

/** Auto-assign approver types based on number of levels */
function getLevelsForCount(count: number): ApprovalLevel[] {
  if (count === 1) return [{ type: 'manager' }];
  if (count === 2) return [{ type: 'manager' }, { type: 'hr' }];
  return [{ type: 'manager' }, { type: 'manager_manager' }, { type: 'hr' }];
}

const LEVEL_LABELS: Record<string, string> = {
  manager: "Employee's Manager",
  manager_manager: "Manager's Manager",
  hr: 'HR Department',
};

const emptyForm = (): ApprovalConfiguration => ({
  id: '',
  name: '',
  levelsCount: 1,
  levels: getLevelsForCount(1),
  description: '',
  countryId: '',
  leaveTypeId: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: '',
  status: 'ACTIVE',
  createdAt: new Date().toISOString().split('T')[0],
});

export default function ApprovalLevels() {
  const [workflows, setWorkflows] = useState<ApprovalConfiguration[]>([]);
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);


  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<ApprovalConfiguration | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<ApprovalConfiguration>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [historyTarget, setHistoryTarget] = useState<{ entityType: string; entityId: string; name: string } | null>(null);

  const loadData = async (signal?: AbortSignal) => {
    setLoading(true);
    setApiError(null);
    try {
      const [wfs, cList, ltList] = await Promise.all([
        getApprovalWorkflows(signal),
        getCountries(signal),
        getLeaveTypes(signal),
      ]);
      setWorkflows(wfs);
      setCountries(cList || []);
      setLeaveTypes(ltList || []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Failed to load approval workflows data';
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

  const filtered = workflows.filter(
    (config) =>
      config.name.toLowerCase().includes(search.toLowerCase()) ||
      (config.description && config.description.toLowerCase().includes(search.toLowerCase()))
  );

  function openAdd() {
    setForm({
      ...emptyForm(),
      countryId: countries[0]?.id || '',
      leaveTypeId: leaveTypes[0]?.id || '',
    });
    setEditConfig(null);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(config: ApprovalConfiguration) {
    setForm(JSON.parse(JSON.stringify(config)));
    setEditConfig(config);
    setErrors({});
    setFormOpen(true);
  }

  function handleLevelsCountChange(count: number) {
    setForm((p) => ({ ...p, levelsCount: count, levels: getLevelsForCount(count) }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) {
      newErrors.name = 'Configuration name is required';
    }
    if (!form.countryId) {
      newErrors.countryId = 'Employee country is required';
    }
    if (!form.leaveTypeId) {
      newErrors.leaveTypeId = 'Leave type is required';
    }
    if (!form.effectiveFrom) {
      newErrors.effectiveFrom = 'Effective date is required';
    }



    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      if (editConfig && form.id) {
        await updateApprovalWorkflow(form.id, form);
      } else {
        await createApprovalWorkflow(form);
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
      await deleteApprovalWorkflow(deleteId);
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Approval Levels</h1>
          <p className="text-slate-400 text-sm mt-1">Configure multi-stage approval workflows for leave requests</p>
        </div>
        <button
          onClick={openAdd}
          disabled={Boolean(apiError) || loading}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors cursor-pointer"
        >
          <Plus size={16} /> Add Configuration
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
        <SearchInput value={search} onChange={setSearch} placeholder="Search configurations..." />
      </div>

      {/* Loading state */}
      {loading && !apiError && (
        <div className="py-16 text-center text-slate-400 text-sm flex justify-center items-center gap-2">
          <RefreshCw size={16} className="animate-spin text-violet-600" /> Loading approval configurations...
        </div>
      )}

      {/* Grid List */}
      {!loading && !apiError && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((config) => {
            const country = countries.find((c) => c.id === config.countryId);
            const leaveType = leaveTypes.find((lt) => lt.id === config.leaveTypeId);
            return (
              <div
                key={config.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between hover:border-violet-300 transition-colors"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-violet-50 dark:bg-violet-900/30 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400">
                        <Shield size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800 dark:text-white text-base">{config.name}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase ${
                              config.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {config.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Effective: {config.effectiveFrom} {config.effectiveTo ? `to ${config.effectiveTo}` : 'onward'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setHistoryTarget({ entityType: 'ApprovalWorkflow', entityId: config.id, name: config.name })}
                        className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors cursor-pointer"
                        title="Audit History"
                      >
                        <History size={13} />
                      </button>
                      <button
                        onClick={() => openEdit(config)}
                        className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-violet-600 rounded-xl transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteId(config.id)}
                        className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {country && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-700 px-2 py-0.5 rounded-lg">
                        {country.flag} {country.name}
                      </span>
                    )}
                    {leaveType && (
                      <span
                        className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg border"
                        style={{ color: leaveType.color, borderColor: leaveType.color + '30', backgroundColor: leaveType.color + '10' }}
                      >
                        {leaveType.label}
                      </span>
                    )}
                  </div>

                  {config.description && (
                    <p className="text-xs text-slate-500 mb-4 italic">"{config.description}"</p>
                  )}

                  {/* Levels flow */}
                  <div className="space-y-2.5 mt-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Approval Sequence ({config.levelsCount} {config.levelsCount === 1 ? 'level' : 'levels'})
                    </h4>
                    {config.levels.map((lvl, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-700"
                      >
                        <span className="w-5 h-5 rounded-full bg-violet-600 text-white font-bold text-[10px] flex items-center justify-center">
                          {index + 1}
                        </span>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {LEVEL_LABELS[lvl.type] || lvl.type}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 text-sm">No configurations found</div>
          )}
        </div>
      )}

      {/* Form SlideDrawer */}
      <SlideDrawer
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editConfig ? 'Edit Configuration' : 'Add Configuration'}
        subtitle={editConfig ? `Modifying ${editConfig.name}` : 'Create a new multi-tier approval workflow'}
      >
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 h-full overflow-y-auto">
          {errors.form && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 dark:text-red-300 rounded-xl text-xs flex items-center gap-1.5">
              <AlertCircle size={14} /> {errors.form}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Configuration Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Finance Team Workflow"
              className={`w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border ${
                errors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
              } rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`}
            />
            {errors.name && (
              <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1">
                <AlertCircle size={10} /> {errors.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe when this approval hierarchy should be applied..."
              rows={2}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Employee Country *
              </label>
              <select
                value={form.countryId || ''}
                onChange={(e) => setForm((p) => ({ ...p, countryId: e.target.value }))}
                className={`w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border ${
                  errors.countryId ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                } rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`}
              >
                <option value="">Select country...</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
              {errors.countryId && (
                <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> {errors.countryId}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Leave Type *
              </label>
              <select
                value={form.leaveTypeId || ''}
                onChange={(e) => setForm((p) => ({ ...p, leaveTypeId: e.target.value }))}
                className={`w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border ${
                  errors.leaveTypeId ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                } rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`}
              >
                <option value="">Select leave type...</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.label}
                  </option>
                ))}
              </select>
              {errors.leaveTypeId && (
                <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> {errors.leaveTypeId}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Effective From *
              </label>
              <input
                type="date"
                value={form.effectiveFrom || ''}
                onChange={(e) => setForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
                className={`w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border ${
                  errors.effectiveFrom ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                } rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`}
              />
              {errors.effectiveFrom && (
                <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> {errors.effectiveFrom}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Effective To (Optional)
              </label>
              <input
                type="date"
                value={form.effectiveTo || ''}
                onChange={(e) => setForm((p) => ({ ...p, effectiveTo: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Status</label>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }))}
              className={`w-12 h-6 rounded-full p-1 transition-colors focus:outline-none ${
                form.status === 'ACTIVE' ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  form.status === 'ACTIVE' ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Number of Approval Levels
            </label>
            <select
              value={form.levelsCount}
              onChange={(e) => handleLevelsCountChange(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value={1}>1 Level</option>
              <option value={2}>2 Levels</option>
              <option value={3}>3 Levels</option>
            </select>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wide">Approval Sequence Configuration</h3>
            {form.levels.map((lvl, index) => (
              <div
                key={index}
                className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-700 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-600 text-white font-black text-[10px] flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Level {index + 1} Approver
                  </span>
                </div>

                <div>
                  <select
                    value={lvl.type}
                    onChange={(e) => {
                      const nextLevels = [...form.levels];
                      nextLevels[index] = { ...nextLevels[index], type: e.target.value as any };
                      setForm((p) => ({ ...p, levels: nextLevels }));
                    }}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                  >
                    <option value="manager">Employee's Manager (manager)</option>
                    <option value="manager_manager">Manager's Manager (manager_manager)</option>
                    <option value="hr">HR Department (hr)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4 mt-auto border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer flex justify-center items-center gap-2"
            >
              {saving && <RefreshCw size={14} className="animate-spin" />}
              {editConfig ? 'Save Changes' : 'Create Workflow'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Configuration"
        message="Are you sure you want to permanently delete this approval configuration? Employees assigned to it will default to a standard 1-level manager approval."
        confirmLabel="Delete"
        danger
        confirming={saving}
      />

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
