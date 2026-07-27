import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, AlertCircle, Check, RefreshCw } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
import { SelectFilter } from '../components/ui/SelectFilter';
import SlideDrawer from '../components/ui/SlideDrawer';
import ConfirmModal from '../components/ui/ConfirmModal';
import { getCountries } from '../../services/countriesApi';
import type { CountryItem } from '../../services/countriesApi';
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from '../../services/holidaysApi';
import type { FrontendHoliday } from '../../services/mappers/holidayMapper';
import { ApiError } from '../../services/apiClient';

const emptyForm = (defaultCountryId = '') => ({
  name: '',
  date: '',
  countryId: defaultCountryId,
  recurring: true,
});

export default function PublicHolidays() {
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [holidays, setHolidays] = useState<FrontendHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterYear, setFilterYear] = useState('');

  // Drawer/Modal States
  const [formOpen, setFormOpen] = useState(false);
  const [editHolidayItem, setEditHolidayItem] = useState<FrontendHoliday | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const loadData = async (signal?: AbortSignal) => {
    setLoading(true);
    setApiError(null);
    try {
      let loadedCountries = countries;
      if (loadedCountries.length === 0) {
        loadedCountries = await getCountries(signal);
        setCountries(loadedCountries);
      }
      const loadedHolidays = await getHolidays(filterCountry, filterYear, loadedCountries, signal);
      setHolidays(loadedHolidays);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Failed to load public holidays';
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setApiError(null);
      try {
        let loadedCountries = countries;
        if (loadedCountries.length === 0) {
          loadedCountries = await getCountries(controller.signal);
          setCountries(loadedCountries);
        }
        const loadedHolidays = await getHolidays(filterCountry, filterYear, loadedCountries, controller.signal);
        setHolidays(loadedHolidays);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Failed to load public holidays';
        setApiError(msg);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [filterCountry, filterYear]);

  const years = [
    ...new Set(
      holidays.map((h) => (h.date ? new Date(h.date).getFullYear().toString() : '2026'))
    ),
  ].sort();

  const filtered = holidays
    .filter((h) => h.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  function openAdd() {
    const defaultCountry = countries[0]?.id || '';
    setForm(emptyForm(defaultCountry));
    setEditHolidayItem(null);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(h: FrontendHoliday) {
    setForm({
      name: h.name,
      date: h.date,
      countryId: h.countryId || countries.find((c) => c.name === h.country)?.id || '',
      recurring: h.recurring,
    });
    setEditHolidayItem(h);
    setErrors({});
    setFormOpen(true);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Holiday name is required';
    if (!form.date) newErrors.date = 'Date is required';
    if (!form.countryId) newErrors.countryId = 'Country selection is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      if (editHolidayItem) {
        await updateHoliday(editHolidayItem.id, form, countries);
        setToast('Holiday updated successfully');
      } else {
        await createHoliday(form, countries);
        setToast('Holiday created successfully');
      }
      setTimeout(() => setToast(null), 3000);
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
      await deleteHoliday(deleteId);
      setToast('Holiday deleted successfully');
      setTimeout(() => setToast(null), 3000);
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
    <div className="max-w-4xl mx-auto flex flex-col gap-6 relative">
      {/* Toast alert */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300 rounded-xl shadow-lg transition-all">
          <Check size={16} />
          <span className="text-xs font-semibold">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Public Holidays</h1>
          <p className="text-slate-400 text-sm mt-1">Manage non-working days by country</p>
        </div>
        <button
          onClick={openAdd}
          disabled={Boolean(apiError) || loading}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
        >
          <Plus size={16} /> Add Holiday
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search holiday..." />
        </div>
        <SelectFilter
          label="Country"
          value={filterCountry}
          onChange={setFilterCountry}
          options={countries.map((c) => ({ label: `${c.flag} ${c.name}`, value: c.id }))}
        />
        <SelectFilter
          label="Year"
          value={filterYear}
          onChange={setFilterYear}
          options={years.map((y) => ({ label: y, value: y }))}
        />
      </div>

      {/* Loading state */}
      {loading && !apiError && (
        <div className="py-16 text-center text-slate-400 text-sm flex justify-center items-center gap-2">
          <RefreshCw size={16} className="animate-spin text-violet-600" /> Loading public holidays...
        </div>
      )}

      {/* Table */}
      {!loading && !apiError && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-[11px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 dark:bg-slate-800/50">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Holiday Name</th>
                <th className="py-3 px-4">Country</th>
                <th className="py-3 px-4 text-center">Recurring</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                    No holidays found
                  </td>
                </tr>
              )}
              {filtered.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-200">
                    {new Date(h.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{h.name}</td>
                  <td className="py-3.5 px-4">
                    <span className="flex items-center gap-1.5">
                      <span className="text-lg">{h.flag}</span>{' '}
                      <span className="text-slate-600 dark:text-slate-300">{h.country}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {h.recurring ? (
                      <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        Yearly
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        Once
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => openEdit(h)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteId(h.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Drawer */}
      <SlideDrawer
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editHolidayItem ? 'Edit Holiday' : 'Add Holiday'}
        subtitle={editHolidayItem ? `Modifying ${editHolidayItem.name}` : 'Create a new public non-working day'}
      >
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {errors.form && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 dark:text-red-300 rounded-xl text-xs flex items-center gap-1.5">
              <AlertCircle size={14} /> {errors.form}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Holiday Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Christmas Day"
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className={`w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border ${
                  errors.date ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                } rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`}
              />
              {errors.date && (
                <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> {errors.date}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Country *
              </label>
              <select
                value={form.countryId}
                onChange={(e) => setForm((p) => ({ ...p, countryId: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.flag}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700 mt-2">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Recurring Holiday</span>
              <span className="text-[10px] text-slate-400">Repeats every year on the same date</span>
            </div>
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(e) => setForm((p) => ({ ...p, recurring: e.target.checked }))}
              className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-700 mt-4">
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
              {editHolidayItem ? 'Save Changes' : 'Add Holiday'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Holiday"
        message="Are you sure you want to permanently delete this holiday? This action cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
