import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, AlertCircle, Check, Globe, Flag, Search, Building2 } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
import SlideDrawer from '../components/ui/SlideDrawer';
import CountryDropdownSelect from '../components/ui/CountryDropdownSelect';
import {
  getCountries,
  createCountry,
  updateCountry,
  deleteCountry,
} from '../../services/countriesApi';
import type { CountryItem, CountryPayload } from '../../services/countriesApi';
import { ApiError } from '../../services/apiClient';
import type { WorldCountry } from '../../data/countriesList';
import { useHrPermission } from '../utils/useHrPermissions';

const emptyForm = (): CountryPayload => ({ name: '', code: '', flag: '' });

export default function Countries() {
  const { canManage } = useHrPermission('countries');
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  // Drawer / Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<CountryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<CountryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form
  const [form, setForm] = useState<CountryPayload>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setApiError(null);
    try {
      const data = await getCountries(signal);
      setCountries(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Failed to load countries';
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    loadData(ac.signal);
    return () => ac.abort();
  }, [loadData]);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Filter ──────────────────────────────────────────────
  const filtered = countries.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  });

  // ── Open / Close form ───────────────────────────────────
  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm());
    setErrors({});
    setApiError(null);
    setFormOpen(true);
  };

  const openEdit = (item: CountryItem) => {
    setEditItem(item);
    setForm({ name: item.name, code: item.code, flag: item.flag || '' });
    setErrors({});
    setApiError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditItem(null);
  };

  // ── Validate ────────────────────────────────────────────
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Country name is required';
    if (!form.code.trim()) e.code = 'Country code is required';
    else if (form.code.trim().length !== 2) e.code = 'Code must be exactly 2 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError(null);
    try {
      const payload: CountryPayload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        flag: form.code.trim().toUpperCase(),
      };
      if (editItem) {
        await updateCountry(editItem.id, payload);
        setToast(`Updated "${payload.name}"`);
      } else {
        await createCountry(payload);
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

  // ── Delete ──────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await deleteCountry(deleteItem.id);
      setToast(`"${deleteItem.name}" and all linked data have been deleted`);
      setDeleteItem(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete';
      setApiError(msg);
      setDeleteItem(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Flag helper ─────────────────────────────────────────
  const renderFlag = (code: string, size: 'sm' | 'md' = 'sm') => {
    const lc = code.toLowerCase();
    const dimensions = size === 'md' ? 'w-10 h-7' : 'w-8 h-5.5';
    return (
      <div className={`relative ${dimensions} shrink-0 rounded-md overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center`}>
        <img
          src={`https://flagcdn.com/w80/${lc}.png`}
          alt={code}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).insertAdjacentHTML('afterend',
              `<span class="text-[10px] font-black text-slate-400">${code}</span>`);
          }}
        />
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-bold animate-fade-in border border-emerald-500">
          <Check size={18} /> {toast}
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200/60 dark:border-violet-800/60 shadow-xs">
            <Globe size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
              Countries & Regional Entities
            </h1>
            <p className="text-slate-400 text-xs font-medium mt-0.5">
              Manage corporate operating locations, ISO codes, and national calendars
            </p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer active:scale-95 shrink-0"
          >
            <Plus size={18} /> Add Country
          </button>
        )}
      </div>

      {/* Controls Bar: Search & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="w-full sm:w-80">
          <SearchInput value={search} onChange={setSearch} placeholder="Search country name or ISO code..." />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span>{filtered.length} {filtered.length === 1 ? 'country' : 'countries'} configured</span>
        </div>
      </div>

      {/* Global Error Alert */}
      {apiError && !formOpen && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-600 dark:text-red-300 px-4 py-3 rounded-2xl text-sm font-medium">
          <AlertCircle size={18} className="shrink-0" /> {apiError}
        </div>
      )}

      {/* Main Table Card Container */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-xs overflow-hidden">
        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-3 border-violet-600 border-t-transparent rounded-full animate-spin" />
            <p className="font-semibold text-xs mt-2">Loading operating countries...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
            <Globe size={40} className="text-slate-300 dark:text-slate-600 mb-1" />
            <p className="font-bold text-slate-700 dark:text-slate-300">
              {search ? 'No countries match your filter' : 'No countries registered yet'}
            </p>
            <p className="text-xs text-slate-400 max-w-sm">
              {search ? 'Try clearing your search query to see all entities.' : 'Click "Add Country" above to configure your first operating country.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-xs overflow-hidden flex flex-col transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-violet-200 dark:hover:border-violet-900"
              >
                {/* Top accent bar with flag */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{renderFlag(c.code, 'lg')}</div>
                    <div>
                      <h3 className="text-lg font-black text-white leading-tight">{c.name}</h3>
                      <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-mono font-bold px-2 py-0.5 rounded-lg mt-1">
                        {c.code}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card body with actions */}
                {canManage && (
                  <div className="p-4 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/40">
                    <button
                      onClick={() => openEdit(c)}
                      className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/50 rounded-xl transition-all cursor-pointer"
                      title="Edit Country"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteItem(c)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-all cursor-pointer"
                      title="Delete Country"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Slide Drawer: Create / Edit ── */}
      <SlideDrawer
        isOpen={formOpen}
        onClose={closeForm}
        title={editItem ? 'Edit Operating Country' : 'Add New Country'}
        subtitle={editItem ? `Modifying settings for ${editItem.name}` : 'Configure a new regional corporate entity'}
      >
        <div className="space-y-5 px-1">
          {apiError && formOpen && (
            <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded-2xl text-xs font-semibold">
              <AlertCircle size={16} className="shrink-0" /> {apiError}
            </div>
          )}

          {/* Country Selection Dropdown with Flags */}
          <div>
            <CountryDropdownSelect
              label="Select Country from Global Catalog *"
              selectedCode={form.code}
              selectedName={form.name}
              onSelect={(country: WorldCountry) => {
                setForm({
                  name: country.name,
                  code: country.code,
                  flag: country.code,
                });
                setErrors({});
              }}
              onClear={() => {
                setForm(emptyForm());
              }}
              placeholder="Search country catalog (e.g. France, Lebanon, US)..."
            />
          </div>

          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-slate-200 dark:border-slate-700 w-full"></div>
            <span className="bg-white dark:bg-slate-800 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
              Or Edit Details Manually
            </span>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Country Display Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: '' }); }}
              className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 border ${errors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:outline-none focus:bg-white dark:focus:bg-slate-700 focus:border-violet-500 transition-colors placeholder:text-slate-400`}
              placeholder="e.g. France"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1 font-medium">{errors.name}</p>}
          </div>

          {/* Code Input */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Country Code (ISO 3166-1 Alpha-2) *
            </label>
            <input
              value={form.code}
              onChange={(e) => { setForm({ ...form, code: e.target.value.toUpperCase().slice(0, 2) }); setErrors({ ...errors, code: '' }); }}
              maxLength={2}
              className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 border ${errors.code ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} rounded-xl text-slate-800 dark:text-slate-100 text-sm font-mono font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-700 focus:border-violet-500 transition-colors uppercase placeholder:text-slate-400`}
              placeholder="e.g. FR"
            />
            {errors.code && <p className="text-red-500 text-xs mt-1 font-medium">{errors.code}</p>}
          </div>

          {/* Live Preview Card */}
          {form.code.length === 2 && (
            <div className="flex items-center gap-3 bg-violet-50/60 dark:bg-violet-950/30 rounded-2xl p-3.5 border border-violet-100 dark:border-violet-800/60">
              <span className="text-xs text-violet-700 dark:text-violet-300 font-bold">Selected Flag Preview:</span>
              {renderFlag(form.code, 'md')}
              <span className="text-slate-800 dark:text-white font-bold text-sm">{form.name || '—'}</span>
              <span className="ml-auto text-xs font-mono font-bold bg-violet-600 text-white px-2 py-0.5 rounded-md shadow-2xs">
                {form.code}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
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
            {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Country'}
          </button>
        </div>
      </SlideDrawer>

      {/* ── Delete Confirmation SlideDrawer (Replaces Pop-up) ── */}
      <SlideDrawer
        isOpen={!!deleteItem}
        onClose={() => { if (!deleting) setDeleteItem(null); }}
        title="Delete Operating Country"
        subtitle={deleteItem ? `${deleteItem.name} (${deleteItem.code})` : 'Deletion Confirmation'}
      >
        {deleteItem && (
          <div className="space-y-6">
            {/* Target Country Card Preview */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
              {renderFlag(deleteItem.code, 'md')}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 dark:text-white text-base truncate">
                  {deleteItem.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">ISO Code: {deleteItem.code}</p>
              </div>
              <span className="px-2.5 py-1 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-bold rounded-lg border border-red-200 dark:border-red-800">
                Deletion
              </span>
            </div>

            {/* Warning Alert Banner */}
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-red-800 dark:text-red-200">
                    Critical & Irreversible Action
                  </h4>
                  <p className="text-xs text-red-600/90 dark:text-red-300/80 mt-1 leading-relaxed">
                    Permanently deleting <span className="font-bold">{deleteItem.name}</span> will immediately apply the following system-wide changes:
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Impacts List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Automated System Impacts
              </h4>

              {/* Impact 1: Employees */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Building2 size={16} />
                </div>
                <div className="flex-1 text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-100 block">
                    Linked Employees
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 mt-0.5 block leading-relaxed">
                    All employees attached to this country will be automatically <strong className="text-amber-600 dark:text-amber-400">deactivated (Inactive status)</strong> and their country will be marked as <strong className="text-red-600 dark:text-red-400">« Supprimé »</strong>.
                  </span>
                </div>
              </div>

              {/* Impact 2: Leave Policies */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 size={16} />
                </div>
                <div className="flex-1 text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-100 block">
                    Regional Leave Policies
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 mt-0.5 block leading-relaxed">
                    All leave policies and custom rules configured for this country will be permanently deleted.
                  </span>
                </div>
              </div>

              {/* Impact 3: Public Holidays */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                  <Globe size={16} />
                </div>
                <div className="flex-1 text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-100 block">
                    National Public Holidays
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 mt-0.5 block leading-relaxed">
                    The statutory national holiday calendar for this country will be cleared.
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex gap-3">
              <button
                onClick={() => setDeleteItem(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-sm font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Confirm Deletion</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
