import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Plus, Edit2, Trash2, AlertCircle, Check } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';
import SlideDrawer from '../components/ui/SlideDrawer';
import ConfirmModal from '../components/ui/ConfirmModal';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../../services/departmentsApi';
import type { DepartmentItem, DepartmentPayload } from '../../services/departmentsApi';
import { ApiError } from '../../services/apiClient';

const emptyForm = (): DepartmentPayload => ({ name: '', color: '#8B5CF6', headEmployeeId: null });

export default function Departments() {
  const { state } = useAdmin();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<DepartmentItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<DepartmentItem | null>(null);
  const [form, setForm] = useState<DepartmentPayload>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setApiError(null);
    try {
      setDepartments(await getDepartments(signal));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setApiError(err instanceof Error ? err.message : 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    loadData(ac.signal);
    return () => ac.abort();
  }, [loadData]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm());
    setErrors({});
    setApiError(null);
    setFormOpen(true);
  };

  const openEdit = (dept: DepartmentItem) => {
    setEditItem(dept);
    setForm({ name: dept.name, color: dept.color, headEmployeeId: dept.headEmployeeId });
    setErrors({});
    setApiError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditItem(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setErrors({ name: 'Department name is required' });
      return;
    }
    setSaving(true);
    setApiError(null);
    try {
      const payload: DepartmentPayload = {
        name: form.name.trim(),
        color: form.color,
        headEmployeeId: form.headEmployeeId || null,
      };
      if (editItem) {
        await updateDepartment(editItem.id, payload);
        setToast(`Updated "${payload.name}"`);
      } else {
        await createDepartment(payload);
        setToast(`Added "${payload.name}"`);
      }
      closeForm();
      await loadData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setApiError(err.validationMessages.length ? err.validationMessages.join(', ') : err.message);
      } else {
        setApiError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await deleteDepartment(deleteItem.id);
      setToast('Department deleted');
      setDeleteItem(null);
      await loadData();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleteItem(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-bold animate-fade-in border border-emerald-500">
          <Check size={18} /> {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Departments</h1>
          <p className="text-slate-400 text-sm mt-1">Company structure and team assignments</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer active:scale-95 shrink-0"
        >
          <Plus size={18} /> Add Department
        </button>
      </div>

      {apiError && !formOpen && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-600 dark:text-red-300 px-4 py-3 rounded-2xl text-sm font-medium">
          <AlertCircle size={18} className="shrink-0" /> {apiError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 border-3 border-violet-600 border-t-transparent rounded-full animate-spin" />
          <p className="font-semibold text-xs mt-2">Loading departments...</p>
        </div>
      ) : departments.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
          <Building2 size={40} className="text-slate-300 dark:text-slate-600 mb-1" />
          <p className="font-bold text-slate-700 dark:text-slate-300">No departments yet</p>
          <p className="text-xs text-slate-400 max-w-sm">Click "Add Department" above to create the first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map(dept => {
            const employees = state.employees.filter(e => e.department === dept.name);
            const head = state.employees.find(e => String(e.id) === String(dept.headEmployeeId));

            const teamMap = new Map<string, number>();
            employees.forEach(e => {
              const teamName = e.unit?.trim() || 'General';
              teamMap.set(teamName, (teamMap.get(teamName) || 0) + 1);
            });
            const teams = Array.from(teamMap.entries());

            return (
              <div
                key={dept.id}
                onClick={() => navigate(`/admin/employees?department=${encodeURIComponent(dept.name)}`)}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm cursor-pointer hover:shadow-md hover:border-violet-200 dark:hover:border-violet-800 transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: dept.color }}><Building2 size={18} /></div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">{dept.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                      <Users size={12}/> {employees.length}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(dept); }}
                      className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/50 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Edit Department"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteItem(dept); }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Delete Department"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 mb-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department Head</p>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center text-[10px] font-bold">{head?.name.charAt(0) || '?'}</div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{head?.name || 'Unassigned'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Teams</p>
                  {teams.length === 0 ? (
                    <p className="text-xs text-slate-400">No employees assigned yet</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {teams.map(([name, count]) => (
                        <div key={name} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-300 font-medium">{name}</span>
                          <span className="text-xs text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">{count} member{count === 1 ? '' : 's'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SlideDrawer
        isOpen={formOpen}
        onClose={closeForm}
        title={editItem ? 'Edit Department' : 'Add New Department'}
        subtitle={editItem ? `Modifying settings for ${editItem.name}` : 'Create a new company department'}
      >
        <div className="space-y-5 px-1">
          {apiError && formOpen && (
            <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded-2xl text-xs font-semibold">
              <AlertCircle size={16} className="shrink-0" /> {apiError}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Department Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors({}); }}
              className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 border ${errors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:outline-none focus:bg-white dark:focus:bg-slate-700 focus:border-violet-500 transition-colors placeholder:text-slate-400`}
              placeholder="e.g. Engineering"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1 font-medium">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer bg-transparent"
              />
              <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{form.color}</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Department Head
            </label>
            <select
              value={form.headEmployeeId || ''}
              onChange={(e) => setForm({ ...form, headEmployeeId: e.target.value || null })}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Unassigned</option>
              {state.employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={closeForm}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-sm font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Department'}
          </button>
        </div>
      </SlideDrawer>

      <ConfirmModal
        isOpen={!!deleteItem}
        title="Delete Department"
        message={`Are you sure you want to delete "${deleteItem?.name}"? Employees currently assigned to it will keep their department label until reassigned.`}
        confirmLabel="Delete Department"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteItem(null)}
      />
    </div>
  );
}
