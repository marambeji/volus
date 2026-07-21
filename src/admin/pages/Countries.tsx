import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, AlertCircle, Check, Globe } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
import SlideDrawer from '../components/ui/SlideDrawer';
import ConfirmModal from '../components/ui/ConfirmModal';
import {
  getCountries,
  createCountry,
  updateCountry,
  deleteCountry,
} from '../../services/countriesApi';
import type { CountryItem, CountryPayload } from '../../services/countriesApi';
import { ApiError } from '../../services/apiClient';

const emptyForm = (): CountryPayload => ({ name: '', code: '', flag: '' });

export default function Countries() {
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  // Drawer / Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<CountryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    if (!deleteId) return;
    try {
      await deleteCountry(deleteId);
      setToast('Country deleted');
      setDeleteId(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete';
      setApiError(msg);
      setDeleteId(null);
    }
  };

  // ── Flag helper ─────────────────────────────────────────
  const renderFlag = (code: string) => {
    const lc = code.toLowerCase();
    return (
      <img
        src={`https://flagcdn.com/w40/${lc}.png`}
        srcSet={`https://flagcdn.com/w80/${lc}.png 2x`}
        alt={code}
        className="w-8 h-5 object-cover rounded-sm"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).insertAdjacentHTML('afterend',
            `<span class="text-sm font-bold text-slate-400">${code}</span>`);
        }}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold animate-fade-in">
          <Check size={16} /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <Globe size={24} /> Countries
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage corporate countries, flags, and codes
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus size={16} /> Add Country
        </button>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <SearchInput value={search} onChange={setSearch} placeholder="Search country..." />
      </div>

      {/* Error */}
      {apiError && !formOpen && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          <AlertCircle size={16} /> {apiError}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Loading countries...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            {search ? 'No countries match your search.' : 'No countries found. Add one above.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                <th className="text-left px-6 py-3 font-bold">Flag</th>
                <th className="text-left px-6 py-3 font-bold">Country Name</th>
                <th className="text-left px-6 py-3 font-bold">Country Code</th>
                <th className="text-right px-6 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3">{renderFlag(c.code)}</td>
                  <td className="px-6 py-3 text-slate-800 font-semibold">{c.name}</td>
                  <td className="px-6 py-3 text-slate-600">{c.code}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(c.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Slide Drawer: Create / Edit ── */}
      <SlideDrawer isOpen={formOpen} onClose={closeForm} title={editItem ? 'Edit Country' : 'Add Country'} subtitle={editItem ? `Editing ${editItem.name}` : 'Register a new country'}>
        <div className="space-y-5 px-1">
          {apiError && formOpen && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
              <AlertCircle size={16} /> {apiError}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Country Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: '' }); }}
              className={`w-full px-4 py-2.5 bg-slate-50 border ${errors.name ? 'border-red-500' : 'border-slate-200'} rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-violet-500 transition-colors placeholder:text-slate-400`}
              placeholder="e.g. Lebanon"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Code */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Country Code (ISO 3166-1 alpha-2) *
            </label>
            <input
              value={form.code}
              onChange={(e) => { setForm({ ...form, code: e.target.value.toUpperCase().slice(0, 2) }); setErrors({ ...errors, code: '' }); }}
              maxLength={2}
              className={`w-full px-4 py-2.5 bg-slate-50 border ${errors.code ? 'border-red-500' : 'border-slate-200'} rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-violet-500 transition-colors uppercase placeholder:text-slate-400`}
              placeholder="e.g. LB"
            />
            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
          </div>

          {/* Preview */}
          {form.code.length === 2 && (
            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
              <span className="text-sm text-slate-500">Preview:</span>
              {renderFlag(form.code)}
              <span className="text-slate-800 font-semibold text-sm">{form.name || '—'}</span>
              <span className="text-slate-500 text-xs">({form.code})</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-3">
          <button
            onClick={closeForm}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-sm font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Country'}
          </button>
        </div>
      </SlideDrawer>

      {/* ── Delete Confirm Modal ── */}
      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Country"
        message="Are you sure? This will remove this country and may affect linked policies and holidays."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
