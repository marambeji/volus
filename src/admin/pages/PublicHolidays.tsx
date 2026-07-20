import { useState } from 'react';
import { Plus, Trash2, Edit2, AlertCircle, Check } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';
import SearchInput from '../components/ui/SearchInput';
import { SelectFilter } from '../components/ui/SelectFilter';
import SlideDrawer from '../components/ui/SlideDrawer';
import ConfirmModal from '../components/ui/ConfirmModal';

const emptyForm = () => ({
  name: '',
  date: '',
  country: 'Lebanon',
  countryCode: 'LB',
  flag: '🇱🇧',
  recurring: true
});

export default function PublicHolidays() {
  const { state, dispatch } = useAdmin();
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterYear, setFilterYear] = useState('');
  
  // Drawer/Modal States
  const [formOpen, setFormOpen] = useState(false);
  const [editHoliday, setEditHoliday] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  
  // Form State
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const countries = [...new Set(state.holidays.map(h => h.country))];
  const years = [...new Set(state.holidays.map(h => new Date(h.date).getFullYear().toString()))];

  const filtered = state.holidays.filter(h => 
    h.name.toLowerCase().includes(search.toLowerCase()) &&
    (!filterCountry || h.country === filterCountry) &&
    (!filterYear || new Date(h.date).getFullYear().toString() === filterYear)
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  function openAdd() {
    setForm(emptyForm());
    setEditHoliday(null);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(h: any) {
    setForm({ ...h });
    setEditHoliday(h);
    setErrors({});
    setFormOpen(true);
  }

  function handleCountryChange(c: string) {
    const codeMap: Record<string, { code: string; flag: string }> = {
      'Lebanon': { code: 'LB', flag: '🇱🇧' },
      'Tunisia': { code: 'TN', flag: '🇹🇳' },
      'France': { code: 'FR', flag: '🇫🇷' },
      'Canada': { code: 'CA', flag: '🇨🇦' },
      'UAE': { code: 'AE', flag: '🇦🇪' },
      'Morocco': { code: 'MA', flag: '🇲🇦' },
      'Egypt': { code: 'EG', flag: '🇪🇬' },
      'Saudi Arabia': { code: 'SA', flag: '🇸🇦' },
      'Spain': { code: 'ES', flag: '🇪🇸' },
      'Argentina': { code: 'AR', flag: '🇦🇷' }
    };
    const mapped = codeMap[c] || { code: 'UN', flag: '🏳️' };
    setForm(p => ({ ...p, country: c, countryCode: mapped.code, flag: mapped.flag }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Holiday name is required';
    if (!form.date) {
      newErrors.date = 'Date is required';
    } else {
      // Check for duplicate date in the same country
      const hasDuplicate = state.holidays.some(h => 
        h.country === form.country && 
        h.date === form.date && 
        (!editHoliday || h.id !== editHoliday.id)
      );
      if (hasDuplicate) {
        newErrors.date = `A holiday is already configured on this date for ${form.country}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    if (editHoliday) {
      dispatch({ type: 'UPDATE_HOLIDAY', payload: { ...form, id: editHoliday.id } });
      setToast('Holiday updated successfully');
    } else {
      const id = Math.max(...state.holidays.map(h => h.id), 0) + 1;
      dispatch({ type: 'ADD_HOLIDAY', payload: { ...form, id } });
      setToast('Holiday created successfully');
    }
    setTimeout(() => setToast(null), 3000);
    setFormOpen(false);
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
        <button onClick={openAdd} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer">
          <Plus size={16} /> Add Holiday
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48"><SearchInput value={search} onChange={setSearch} placeholder="Search holiday..." /></div>
        <SelectFilter label="Country" value={filterCountry} onChange={setFilterCountry} options={countries.map(c => ({ label: c, value: c }))} />
        <SelectFilter label="Year" value={filterYear} onChange={setFilterYear} options={years.map(y => ({ label: y, value: y }))} />
      </div>

      {/* Table */}
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
              <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm">No holidays found</td></tr>
            )}
            {filtered.map(h => (
              <tr key={h.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-200">{new Date(h.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{h.name}</td>
                <td className="py-3.5 px-4">
                  <span className="flex items-center gap-1.5"><span className="text-lg">{h.flag}</span> <span className="text-slate-600 dark:text-slate-300">{h.country}</span></span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  {h.recurring ? <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold">Yearly</span> : <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold">Once</span>}
                </td>
                <td className="py-3.5 px-4 text-center">
                  <div className="flex justify-center gap-1.5">
                    <button onClick={() => openEdit(h)} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer" title="Edit"><Edit2 size={13}/></button>
                    <button onClick={() => setDeleteId(h.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer" title="Delete"><Trash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Drawer */}
      <SlideDrawer isOpen={formOpen} onClose={() => setFormOpen(false)} title={editHoliday ? 'Edit Holiday' : 'Add Holiday'} subtitle={editHoliday ? `Modifying ${editHoliday.name}` : 'Create a new public non-working day'}>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Holiday Name *</label>
            <input type="text" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Christmas Day" className={`w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border ${errors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`} />
            {errors.name && <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={10}/> {errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date *</label>
              <input type="date" required value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={`w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border ${errors.date ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`} />
              {errors.date && <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={10}/> {errors.date}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country</label>
              <select value={form.country} onChange={e => handleCountryChange(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="Lebanon">Lebanon 🇱🇧</option>
                <option value="Tunisia">Tunisia 🇹🇳</option>
                <option value="France">France 🇫🇷</option>
                <option value="Canada">Canada 🇨🇦</option>
                <option value="UAE">UAE 🇦🇪</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700 mt-2">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Recurring Holiday</span>
              <span className="text-[10px] text-slate-400">Repeats every year on the same date</span>
            </div>
            <input type="checkbox" checked={form.recurring} onChange={e => setForm(p => ({ ...p, recurring: e.target.checked }))} className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-700 mt-4">
            <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 text-sm font-bold text-white bg-violet-600 rounded-xl hover:bg-violet-700 cursor-pointer">{editHoliday ? 'Save Changes' : 'Add Holiday'}</button>
          </div>
        </form>
      </SlideDrawer>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            dispatch({ type: 'DELETE_HOLIDAY', payload: deleteId });
            setToast('Holiday deleted successfully');
            setTimeout(() => setToast(null), 3000);
            setDeleteId(null);
          }
        }}
        title="Delete Holiday"
        message="Are you sure you want to permanently delete this holiday? This action cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
