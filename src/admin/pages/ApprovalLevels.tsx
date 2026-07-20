import { useState } from 'react';
import { Plus, Edit2, Trash2, Shield, AlertCircle } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';
import type { ApprovalConfiguration, ApprovalLevel, ApproverType } from '../types/adminTypes';
import SearchInput from '../components/ui/SearchInput';
import SlideDrawer from '../components/ui/SlideDrawer';
import ConfirmModal from '../components/ui/ConfirmModal';

const emptyLevel: ApprovalLevel = { type: 'manager', specificEmployeeEmail: '' };

const emptyForm = (id: string): ApprovalConfiguration => ({
  id,
  name: '',
  levelsCount: 1,
  levels: [{ ...emptyLevel }],
  description: '',
  createdAt: new Date().toISOString().split('T')[0]
});

export default function ApprovalLevels() {
  const { state, dispatch } = useAdmin();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<ApprovalConfiguration | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<ApprovalConfiguration>(emptyForm(''));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = state.approvalLevels.filter(config =>
    config.name.toLowerCase().includes(search.toLowerCase()) ||
    (config.description && config.description.toLowerCase().includes(search.toLowerCase()))
  );

  function openAdd() {
    const id = `app-${Date.now()}`;
    setForm(emptyForm(id));
    setEditConfig(null);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(config: ApprovalConfiguration) {
    setForm(JSON.parse(JSON.stringify(config))); // Deep copy
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
    setForm(p => ({ ...p, levelsCount: count, levels: nextLevels }));
  }

  function handleLevelChange(index: number, field: keyof ApprovalLevel, value: any) {
    const nextLevels = [...form.levels];
    nextLevels[index] = { ...nextLevels[index], [field]: value };
    setForm(p => ({ ...p, levels: nextLevels }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) {
      newErrors.name = 'Configuration name is required';
    }

    form.levels.forEach((lvl, idx) => {
      if (lvl.type === 'specific_employee') {
        if (!lvl.specificEmployeeEmail?.trim()) {
          newErrors[`level_${idx}`] = 'Approver email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lvl.specificEmployeeEmail)) {
          newErrors[`level_${idx}`] = 'Please enter a valid email address';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    if (editConfig) {
      dispatch({ type: 'UPDATE_APPROVAL_LEVEL', payload: form });
    } else {
      dispatch({ type: 'ADD_APPROVAL_LEVEL', payload: form });
    }
    setFormOpen(false);
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Approval Levels</h1>
          <p className="text-slate-400 text-sm mt-1">Configure multi-stage approval workflows for leave requests</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors cursor-pointer">
          <Plus size={16} /> Add Configuration
        </button>
      </div>

      {/* Filter and search */}
      <div className="w-full sm:w-64">
        <SearchInput value={search} onChange={setSearch} placeholder="Search configurations..." />
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(config => (
          <div key={config.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between hover:border-violet-300 transition-colors">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-50 dark:bg-violet-900/30 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-base">{config.name}</h3>
                    <p className="text-[10px] text-slate-400">Created: {config.createdAt}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(config)} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-violet-600 rounded-xl transition-colors cursor-pointer" title="Edit"><Edit2 size={13}/></button>
                  <button onClick={() => setDeleteId(config.id)} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer" title="Delete"><Trash2 size={13}/></button>
                </div>
              </div>

              {config.description && (
                <p className="text-xs text-slate-500 mb-4 italic">"{config.description}"</p>
              )}

              {/* Levels flow */}
              <div className="space-y-2.5 mt-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Approval Sequence ({config.levelsCount} {config.levelsCount === 1 ? 'level' : 'levels'})</h4>
                {config.levels.map((lvl, index) => (
                  <div key={index} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-700">
                    <span className="w-5 h-5 rounded-full bg-violet-600 text-white font-bold text-[10px] flex items-center justify-center">{index + 1}</span>
                    <div className="text-xs">
                      <p className="font-bold text-slate-700 dark:text-slate-200">
                        {lvl.type === 'manager' && 'Employee\'s Manager'}
                        {lvl.type === 'manager_manager' && 'Manager\'s Manager'}
                        {lvl.type === 'specific_employee' && 'Specific Employee'}
                      </p>
                      {lvl.type === 'specific_employee' && (
                        <p className="text-[10px] text-slate-400 truncate max-w-48">{lvl.specificEmployeeEmail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 text-sm">No configurations found</div>
        )}
      </div>

      {/* Form SlideDrawer */}
      <SlideDrawer isOpen={formOpen} onClose={() => setFormOpen(false)} title={editConfig ? 'Edit Configuration' : 'Add Configuration'} subtitle={editConfig ? `Modifying ${editConfig.name}` : 'Create a new multi-tier approval workflow'}>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 h-full">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Configuration Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Finance Team Workflow"
              className={`w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border ${errors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`}
            />
            {errors.name && (
              <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={10} /> {errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe when this approval hierarchy should be applied..."
              rows={2}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Number of Approval Levels</label>
            <select
              value={form.levelsCount}
              onChange={e => handleLevelsCountChange(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value={1}>1 Level</option>
              <option value={2}>2 Levels</option>
              <option value={3}>3 Levels</option>
            </select>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wide">Approvers Sequence</h3>
            {form.levels.map((lvl, index) => (
              <div key={index} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-600 text-white font-black text-[10px] flex items-center justify-center">{index + 1}</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Level {index + 1} Approver</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Approver Type</label>
                    <select
                      value={lvl.type}
                      onChange={e => handleLevelChange(index, 'type', e.target.value as ApproverType)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="manager">Employee's Manager</option>
                      <option value="manager_manager">Manager's Manager</option>
                      <option value="specific_employee">Specific Employee (Email)</option>
                    </select>
                  </div>

                  {lvl.type === 'specific_employee' && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Employee Email</label>
                      <input
                        type="email"
                        value={lvl.specificEmployeeEmail || ''}
                        onChange={e => handleLevelChange(index, 'specificEmployeeEmail', e.target.value)}
                        placeholder="approver@novelus.com"
                        className={`w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border ${errors[`level_${index}`] ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      />
                      {errors[`level_${index}`] && (
                        <p className="text-red-500 text-[9px] mt-1 flex items-center gap-0.5"><AlertCircle size={8} /> {errors[`level_${index}`]}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4 mt-auto border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors cursor-pointer">{editConfig ? 'Save Changes' : 'Create Workflow'}</button>
          </div>
        </form>
      </SlideDrawer>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            dispatch({ type: 'DELETE_APPROVAL_LEVEL', payload: deleteId });
            setDeleteId(null);
          }
        }}
        title="Delete Configuration"
        message={`Are you sure you want to permanently delete this approval configuration? Employees assigned to it will default to a standard 1-level manager approval.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
