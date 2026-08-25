import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Shield, AlertCircle, RefreshCw, History } from 'lucide-react';
import type { ApprovalConfiguration, ApprovalLevel, ApproverType } from '../types/adminTypes';
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
import { getEmployees, type BackendEmployee } from '../../services/employeesApi';
import { getDivisions, type DivisionItem } from '../../services/divisionsApi';
import { getDepartments, type DepartmentItem } from '../../services/departmentsApi';
import { ApiError } from '../../services/apiClient';
import { useHrPermission } from '../utils/useHrPermissions';

const emptyLevel: ApprovalLevel = { type: 'manager' };

const emptyForm = (): ApprovalConfiguration => ({
  id: '',
  name: '',
  levelsCount: 1,
  levels: [{ ...emptyLevel }],
  description: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: '',
  status: 'ACTIVE',
  createdAt: new Date().toISOString().split('T')[0],
});

export default function ApprovalLevels() {
  const { canManage } = useHrPermission('approvalLevels');
  const [workflows, setWorkflows] = useState<ApprovalConfiguration[]>([]);
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [divisions, setDivisions] = useState<DivisionItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);

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

  // Per-level department employees (loaded lazily on department selection)
  const [deptEmployees, setDeptEmployees] = useState<Record<number, BackendEmployee[]>>({});
  const [deptLoading, setDeptLoading] = useState<Record<number, boolean>>({});

  const loadData = async (signal?: AbortSignal) => {
    setLoading(true);
    setApiError(null);
    try {
      const [wfs, cList, ltList, empList, divList, deptList] = await Promise.all([
        getApprovalWorkflows(signal),
        getCountries(signal),
        getLeaveTypes(signal),
        getEmployees({ limit: 1000 }, signal),
        getDivisions(signal),
        getDepartments(signal),
      ]);
      setWorkflows(wfs);
      setCountries(cList || []);
      setLeaveTypes(ltList || []);
      setEmployees(empList || []);
      setDivisions(divList || []);
      setDepartments(deptList || []);
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
    setForm(emptyForm());
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
    const nextLevels = [...form.levels];
    if (count > nextLevels.length) {
      while (nextLevels.length < count) {
        nextLevels.push({ ...emptyLevel });
      }
    } else if (count < nextLevels.length) {
      nextLevels.splice(count);
    }
    setForm((p) => ({ ...p, levelsCount: count, levels: nextLevels }));
  }

  async function loadEmployeesForDept(index: number, deptId: string) {
    setDeptLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const emps = await getEmployees({ status: 'ACTIVE', divisionId: deptId, limit: 500 });
      setDeptEmployees((prev) => ({ ...prev, [index]: emps }));
    } catch {
      setDeptEmployees((prev) => ({ ...prev, [index]: [] }));
    } finally {
      setDeptLoading((prev) => ({ ...prev, [index]: false }));
    }
  }

  function handleLevelChange(index: number, field: keyof ApprovalLevel, value: any) {
    const nextLevels = [...form.levels];
    const prev = nextLevels[index];

    if (field === 'type') {
      if (value !== 'specific_employee' && prev.type === 'specific_employee') {
        nextLevels[index] = { type: value as ApproverType };
        setDeptEmployees((d) => { const n = { ...d }; delete n[index]; return n; });
      } else if (value === 'specific_employee' && prev.type !== 'specific_employee') {
        nextLevels[index] = {
          type: value as ApproverType,
          departmentId: undefined,
          specificApproverEmployeeId: undefined,
          specificEmployeeEmail: undefined,
        };
      } else {
        nextLevels[index] = { ...prev, type: value as ApproverType };
      }
    } else if (field === 'departmentId') {
      nextLevels[index] = {
        ...prev,
        departmentId: value || undefined,
        specificApproverEmployeeId: undefined,
        specificEmployeeEmail: undefined,
      };
      if (value) {
        void loadEmployeesForDept(index, value);
      } else {
        setDeptEmployees((d) => { const n = { ...d }; delete n[index]; return n; });
      }
    } else if (field === 'specificApproverEmployeeId') {
      const selected = (deptEmployees[index] || employees).find((emp) => emp.id === value);
      nextLevels[index] = {
        ...prev,
        specificApproverEmployeeId: value || undefined,
        specificEmployeeEmail: selected?.email || undefined,
      };
    } else {
      nextLevels[index] = { ...prev, [field]: value };
    }

    setForm((p) => ({ ...p, levels: nextLevels }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) {
      newErrors.name = 'Configuration name is required';
    }
    if (!form.effectiveFrom) {
      newErrors.effectiveFrom = 'Effective date is required';
    }

    // No per-level validation needed for specific_employee
    // — department/person are managed via Leave Policies

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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Approval Workflows</h1>
          <p className="text-sm text-slate-400 mt-1">Configure multi-stage approval workflows for leave requests</p>
        </div>
        {canManage && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-violet-600/20 cursor-pointer"
          >
            <Plus size={18} />
            Add Configuration
          </button>
        )}
      </div>

      {apiError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-center justify-between text-red-600 dark:text-red-400 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{apiError}</span>
          </div>
          <button onClick={() => void loadData()} className="flex items-center gap-1 text-xs font-bold underline hover:opacity-80">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex-1 max-w-md">
          <SearchInput value={search} onChange={setSearch} placeholder="Search configurations..." />
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
          <RefreshCw size={18} className="animate-spin" /> Loading configurations...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-100 dark:border-slate-700 space-y-3">
          <Shield size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="font-bold text-slate-600 dark:text-slate-300">No approval configurations found</p>
          <p className="text-xs text-slate-400">Click "Add Configuration" to create your first multi-tier approval workflow.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((config) => {
            const countryName = countries.find((c) => c.id === config.countryId)?.name || 'Global / Default';
            const leaveTypeLabel = leaveTypes.find((lt) => lt.id === config.leaveTypeId)?.label || 'All Types';
            const levelsCount = config.levelsCount || config.levels.length;

            return (
              <div
                key={config.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
              >
                <div className="space-y-4">
                  {/* Card Header: Shield icon, Title, Status & Actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0 border border-purple-100 dark:border-purple-900/50">
                        <Shield size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800 dark:text-white text-base">{config.name}</h3>
                          <span
                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              config.status === 'ACTIVE'
                                ? 'bg-emerald-100/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                            }`}
                          >
                            {config.status || 'ACTIVE'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Effective: {config.effectiveFrom || '2026-01-01'} {config.effectiveTo ? `to ${config.effectiveTo}` : 'onward'}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons on top right */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setHistoryTarget({ entityType: 'ApprovalWorkflow', entityId: config.id, name: config.name })}
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="History"
                      >
                        <History size={15} />
                      </button>
                      {canManage && (
                      <button
                        onClick={() => openEdit(config)}
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 size={15} />
                      </button>
                      )}
                      {canManage && (
                      <button
                        onClick={() => setDeleteId(config.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                      )}
                    </div>
                  </div>

                  {/* Scope & Sequence Pill */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/40">
                      General Workflow
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {levelsCount} {levelsCount === 1 ? 'Level' : 'Levels'}
                    </span>
                  </div>

                  {/* Approval Sequence Section */}
                  <div className="space-y-2 pt-2">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      APPROVAL SEQUENCE ({levelsCount} {levelsCount === 1 ? 'LEVEL' : 'LEVELS'})
                    </p>
                    <div className="space-y-2 bg-slate-50/80 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                      {config.levels.map((lvl, idx) => (
                        <div key={idx} className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-violet-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {lvl.type === 'manager'
                              ? "Employee's Manager"
                              : lvl.type === 'manager_manager'
                              ? "Manager's Manager"
                              : lvl.type === 'specific_employee' || (lvl.type as string) === 'SPECIFIC_PERSON'
                              ? 'Specific Person'
                              : 'HR Department'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer for Create / Edit */}
      <SlideDrawer
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editConfig ? 'Edit Configuration' : 'Add Configuration'}
        subtitle={editConfig ? 'Update multi-tier approval workflow' : 'Create a new multi-tier approval workflow'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {errors.form && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2 font-medium">
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
              placeholder="e.g., France Standard 2-Tier Approval"
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
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={form.description || ''}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe when this approval hierarchy should be applied..."
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
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
                className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-700 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-600 text-white font-black text-[10px] flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Level {index + 1} Approver
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Approver Type</label>
                    <select
                      value={lvl.type}
                      onChange={(e) => handleLevelChange(index, 'type', e.target.value as ApproverType)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                    >
                      <option value="manager">Employee's Manager (manager)</option>
                      <option value="manager_manager">Manager's Manager (manager_manager)</option>
                      <option value="specific_employee">Specific Person (specific_person)</option>
                      <option value="hr">HR Department (hr)</option>
                    </select>
                  </div>
                </div>

                {/* Specific Person fields removed - not needed in Approval Levels */}

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
