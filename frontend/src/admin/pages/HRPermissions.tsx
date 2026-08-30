import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
import SlideDrawer from '../components/ui/SlideDrawer';
import { getHrAdmins, setHrPermissions, type HrAdminListItem } from '../../services/hrPermissionsApi';
import { HR_MODULES, HR_MODULE_LABELS, type HrModule, type HrPermissionMap } from '../types/hrPermissions';
import { ApiError } from '../../services/apiClient';

export default function HRPermissions() {
  const [admins, setAdmins] = useState<HrAdminListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<HrAdminListItem | null>(null);
  const [draft, setDraft] = useState<HrPermissionMap | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setApiError(null);
    try {
      const list = await getHrAdmins(signal);
      setAdmins(list || []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setApiError(err instanceof ApiError ? err.message : 'Failed to load HR Admin users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const filtered = admins.filter(a =>
    a.fullName.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase()),
  );

  function openManage(admin: HrAdminListItem) {
    setSelected(admin);
    setDraft({ ...admin.permissions });
  }

  function toggle(module: HrModule, field: 'canView' | 'canManage') {
    if (!draft) return;
    setDraft({
      ...draft,
      [module]: { ...draft[module], [field]: !draft[module][field] },
    });
  }

  async function handleSave() {
    if (!selected || !draft) return;
    setSaving(true);
    try {
      const entries = HR_MODULES.map(module => ({
        module,
        canView: draft[module].canView,
        canManage: draft[module].canManage,
      }));
      const updated = await setHrPermissions(selected.id, entries);
      setAdmins(prev => prev.map(a => (a.id === selected.id ? { ...a, permissions: updated } : a)));
      setSelected(null);
      setDraft(null);
    } catch (err: unknown) {
      setApiError(err instanceof ApiError ? err.message : 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">HR Permissions</h1>
        <p className="text-slate-400 text-sm mt-1">Control what each HR Admin user can view or manage</p>
      </div>

      {apiError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-xl p-3 flex items-center gap-2 text-red-600 dark:text-red-300 text-sm">
          <AlertCircle size={16} /> {apiError}
        </div>
      )}

      <div className="max-w-md"><SearchInput value={search} onChange={setSearch} placeholder="Search HR admin name or email..." /></div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 text-[11px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50/50">
              <th className="py-3.5 px-4">HR Admin</th>
              <th className="py-3.5 px-4">Email</th>
              <th className="py-3.5 px-4 text-center">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {loading && (
              <tr><td colSpan={3} className="py-10 text-center text-slate-400"><Loader2 className="inline animate-spin" size={18} /></td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={3} className="py-16 text-center text-slate-400 text-sm">No HR Admin users found</td></tr>
            )}
            {filtered.map(admin => (
              <tr key={admin.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                <td className="py-3.5 px-4">
                  <button
                    onClick={() => !admin.isSuperAdmin && openManage(admin)}
                    className={`font-bold text-slate-800 dark:text-slate-200 ${admin.isSuperAdmin ? 'cursor-default' : 'hover:text-violet-600 cursor-pointer'}`}
                  >
                    {admin.fullName}
                  </button>
                  {admin.isSuperAdmin && (
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      <ShieldCheck size={10} /> Super Admin
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-slate-500 text-xs">{admin.email}</td>
                <td className="py-3.5 px-4 text-center">
                  {!admin.isSuperAdmin && (
                    <button onClick={() => openManage(admin)} className="text-violet-600 hover:text-violet-800 text-xs font-bold cursor-pointer">
                      Manage Access
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SlideDrawer
        isOpen={!!selected}
        onClose={() => { setSelected(null); setDraft(null); }}
        title="Manage Access"
        subtitle={selected ? `${selected.fullName} — ${selected.email}` : ''}
      >
        {draft && (
          <div className="flex flex-col gap-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  <th className="py-2">Module</th>
                  <th className="py-2 text-center">View</th>
                  <th className="py-2 text-center">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {HR_MODULES.map(module => (
                  <tr key={module}>
                    <td className="py-2 text-slate-700 dark:text-slate-200 font-medium">{HR_MODULE_LABELS[module]}</td>
                    <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${module}-view`}
                        checked={draft[module].canView}
                        onChange={() => toggle(module, 'canView')}
                        className="accent-violet-600 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${module}-manage`}
                        checked={draft[module].canManage}
                        onChange={() => toggle(module, 'canManage')}
                        className="accent-violet-600 w-4 h-4 cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
