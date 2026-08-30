import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, AlertCircle, Check, RefreshCw, Calendar, Globe2, RotateCcw, Sun } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
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
import { useHrPermission } from '../utils/useHrPermissions';

const emptyForm = (defaultCountryId = '') => ({
  name: '',
  date: '',
  countryId: defaultCountryId,
  recurring: true,
  isGlobal: false,
});

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Unified violet/indigo palette — consistent with the app design system */
const MONTH_COLORS = [
  'from-violet-500 to-indigo-600',   // Jan
  'from-indigo-500 to-violet-600',   // Feb
  'from-violet-600 to-indigo-700',   // Mar
  'from-indigo-600 to-violet-700',   // Apr
  'from-violet-500 to-purple-600',   // May
  'from-purple-500 to-violet-600',   // Jun
  'from-indigo-600 to-violet-700',   // Jul
  'from-violet-600 to-indigo-700',   // Aug
  'from-violet-500 to-indigo-600',   // Sep
  'from-indigo-500 to-violet-600',   // Oct
  'from-violet-600 to-purple-700',   // Nov
  'from-indigo-600 to-violet-700',   // Dec
];

export default function PublicHolidays() {
  const { canManage } = useHrPermission('publicHolidays');
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [holidays, setHolidays] = useState<FrontendHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterYear, setFilterYear] = useState('');

  // Drawer / Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editHolidayItem, setEditHolidayItem] = useState<FrontendHoliday | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const loadData = async (signal?: AbortSignal) => {
    setLoading(true);
    setApiError(null);
    try {
      let loaded = countries;
      if (loaded.length === 0) {
        loaded = await getCountries(signal);
        setCountries(loaded);
      }
      const data = await getHolidays(filterCountry, filterYear, loaded, signal);
      setHolidays(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setApiError(err instanceof Error ? err.message : 'Failed to load public holidays');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [filterCountry, filterYear]);

  // Year options derived from data
  const years = [...new Set(
    holidays.map(h => h.date ? new Date(h.date).getFullYear().toString() : '2026')
  )].sort();

  const filtered = holidays
    .filter(h =>
      h.name.toLowerCase().includes(search.toLowerCase()) &&
      (!filterCountry || h.countryId === filterCountry)
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Stats
  const recurringCount  = filtered.filter(h => h.recurring).length;
  const onceCount       = filtered.filter(h => !h.recurring).length;
  const countryCount    = new Set(filtered.map(h => h.country)).size;
  const upcoming        = filtered.filter(h => new Date(h.date) >= new Date()).length;

  function openAdd() {
    setForm(emptyForm(countries[0]?.id || ''));
    setEditHolidayItem(null);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(h: FrontendHoliday) {
    setForm({
      name:      h.name,
      date:      h.date,
      countryId: h.countryId || countries.find(c => c.name === h.country)?.id || '',
      recurring: h.recurring,
      isGlobal:  false,
    });
    setEditHolidayItem(h);
    setErrors({});
    setFormOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim())   e.name      = 'Holiday name is required';
    if (!form.date)          e.date      = 'Date is required';
    if (!form.isGlobal && !form.countryId) e.countryId = 'Country selection is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editHolidayItem) {
        await updateHoliday(editHolidayItem.id, form, countries);
        setToast('Holiday updated successfully');
      } else {
        if (form.isGlobal) {
          // Create holiday for all countries
          const createPromises = countries.map(country =>
            createHoliday({ ...form, countryId: country.id }, countries)
          );
          await Promise.all(createPromises);
          setToast(`Global holiday created in ${countries.length} countries`);
        } else {
          await createHoliday(form, countries);
          setToast('Holiday created successfully');
        }
      }
      setTimeout(() => setToast(null), 3000);
      setFormOpen(false);
      await loadData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const msgs = err.validationMessages;
        setErrors(prev => ({ ...prev, form: msgs.length > 0 ? msgs.join(' | ') : err.message }));
      } else {
        setErrors(prev => ({ ...prev, form: err instanceof Error ? err.message : 'Save failed' }));
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
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6 flex flex-col gap-6 relative">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl shadow-lg">
          <Check size={16} className="text-emerald-500" />
          <span className="text-xs font-semibold">{toast}</span>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Public Holidays</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">Manage non-working days by country</p>
        </div>
        {canManage && (
          <button
            onClick={openAdd}
            disabled={Boolean(apiError) || loading}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg transition-all cursor-pointer"
          >
            <Plus size={16} /> Add Holiday
          </button>
        )}
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Holidays',    value: filtered.length, icon: <Calendar size={18} />,  color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30' },
          { label: 'Upcoming',          value: upcoming,        icon: <Sun size={18} />,        color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
          { label: 'Countries',         value: countryCount,    icon: <Globe2 size={18} />,     color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
          { label: 'Recurring / Once',  value: `${recurringCount} / ${onceCount}`, icon: <RotateCcw size={18} />, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3 shadow-xs">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
              {s.icon}
            </div>
            <div>
              <div className="text-xl font-black text-slate-800 dark:text-white">{s.value}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Error Banner ──────────────────────────────────────────────── */}
      {apiError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span className="text-sm font-medium">{apiError}</span>
          </div>
          <button
            onClick={() => void loadData()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-800/40 text-red-800 dark:text-red-200 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3 flex flex-wrap items-center gap-3 shadow-xs">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search holiday..." />
        </div>
        <select
          value={filterCountry}
          onChange={e => setFilterCountry(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
        >
          <option value="">🌍 All Countries</option>
          {countries.map(c => (
            <option key={c.id} value={c.id}>{c.flag} {c.name}</option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
        >
          <option value="">📅 All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {(search || filterCountry || filterYear) && (
          <button
            onClick={() => { setSearch(''); setFilterCountry(''); setFilterYear(''); }}
            className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Reset Filters"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading && !apiError && (
        <div className="py-20 text-center text-slate-400 text-sm flex justify-center items-center gap-2">
          <RefreshCw size={16} className="animate-spin text-violet-600" /> Loading public holidays…
        </div>
      )}

      {/* ── Holiday Card Grid ─────────────────────────────────────────── */}
      {!loading && !apiError && (
        <>
          {filtered.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-16 text-center shadow-xs">
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="text-base font-extrabold text-slate-700 dark:text-slate-200">No Holidays Found</h3>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or add a new holiday.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(h => {
                const d = new Date(h.date);
                const isValid = !isNaN(d.getTime());
                const monthIdx = isValid ? d.getMonth() : 0;
                const day = isValid ? d.getDate() : '—';
                const month = isValid ? MONTH_NAMES[monthIdx] : '—';
                const year = isValid ? d.getFullYear() : '—';
                const gradientClass = MONTH_COLORS[monthIdx];
                const isPast = isValid && d < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                  <div
                    key={h.id}
                    className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-xs overflow-hidden flex flex-col transition-all hover:shadow-md hover:-translate-y-0.5 ${
                      isPast
                        ? 'border-slate-100 dark:border-slate-700 opacity-60'
                        : 'border-slate-100 dark:border-slate-700 hover:border-violet-200 dark:hover:border-violet-900'
                    }`}
                  >
                    {/* Top accent bar with date */}
                    <div className={`bg-gradient-to-r ${gradientClass} px-5 py-4 flex items-center justify-between`}>
                      <div className="flex items-baseline gap-2 text-white">
                        <span className="text-4xl font-black leading-none">{day}</span>
                        <div>
                          <div className="text-sm font-extrabold uppercase tracking-wider">{month}</div>
                          <div className="text-xs font-bold opacity-80">{year}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl">{h.flag}</span>
                        {isPast && (
                          <div className="text-[9px] font-extrabold uppercase text-white/70 mt-0.5">PAST</div>
                        )}
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-4 flex flex-col gap-3 flex-1">
                      <div>
                        <h3 className="font-extrabold text-slate-800 dark:text-white text-sm leading-snug">{h.name}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{h.country}</p>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-slate-700">
                        {/* Recurring badge */}
                        {h.recurring ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider">
                            <RotateCcw size={9} /> Yearly
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 text-[10px] font-black uppercase tracking-wider">
                            Once
                          </span>
                        )}

                        {/* Actions */}
                        {canManage && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(h)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteId(h.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Add / Edit Drawer ─────────────────────────────────────────── */}
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
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
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

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Date *
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
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

          {!editHolidayItem && (
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Globe2 size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Global Holiday</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Apply to all {countries.length} countries</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.isGlobal}
                onChange={e => setForm(p => ({ ...p, isGlobal: e.target.checked }))}
                className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>
          )}

          {!form.isGlobal && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Country *
              </label>
              <select
                value={form.countryId}
                onChange={e => setForm(p => ({ ...p, countryId: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {countries.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.flag}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700 mt-2">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Recurring Holiday</span>
              <span className="text-[10px] text-slate-400">Repeats every year on the same date</span>
            </div>
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={e => setForm(p => ({ ...p, recurring: e.target.checked }))}
              className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-700 mt-4">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl disabled:opacity-50 cursor-pointer flex justify-center items-center gap-2 shadow-lg transition-all"
            >
              {saving && <RefreshCw size={14} className="animate-spin" />}
              {editHolidayItem ? 'Save Changes' : 'Add Holiday'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* ── Delete Confirmation ───────────────────────────────────────── */}
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
