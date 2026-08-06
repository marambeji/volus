import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Archive, UserCheck, Eye, AlertCircle, CheckCircle, History } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';
import type { AdminEmployee } from '../types/adminTypes';
import SearchInput from '../components/ui/SearchInput';
import { SelectFilter } from '../components/ui/SelectFilter';
import StatusBadge from '../components/ui/StatusBadge';
import SlideDrawer from '../components/ui/SlideDrawer';
import ConfirmModal from '../components/ui/ConfirmModal';
import HistoryDrawer from '../components/HistoryDrawer';
import { createEmployee, updateEmployee, deleteEmployee } from '../../services/employeesApi';
import Pagination from '../../components/ui/Pagination';
import { toAdminEmployee, toBackendEmployeePayload } from '../../services/mappers/employeeMapper';
import { CANONICAL_DEPARTMENT_NAMES } from '../data/adminMockData';
import { apiFetch } from '../../services/apiClient';

const emptyForm = (): Omit<AdminEmployee, 'id'> => ({
  name: '',
  email: '',
  phone: '',
  position: '',
  department: 'Engineering',
  unit: '',
  managerId: undefined,
  country: 'Lebanon',
  countryCode: 'LB',
  hireDate: '',
  status: 'active',
  workingSchedule: 'full_time',
  emergencyContacts: [],
  policyId: 'pol-lb',
  role: 'Employee',
  division: 'Levant',
  approvalLevelId: 'app-1'
});

export default function EmployeeList() {
  const { state, dispatch } = useAdmin();
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [onLeaveIds, setOnLeaveIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterDept, filterCountry, filterStatus]);

  // Fetch who is on leave TODAY using the whos-out endpoint (same as WhosOut widget)
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<any[]>('/leave-requests/whos-out', { signal: controller.signal })
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        const todayStr = new Date().toISOString().split('T')[0];
        const ids = new Set<string>();
        const names = new Set<string>();

        all.forEach((r: any) => {
          const isActive = r.status === 'APPROVED' || r.currentStatus === 'APPROVED'
            || r.status === 'PENDING' || r.currentStatus === 'PENDING';
          const s = (r.startDate || '').split('T')[0];
          const e = (r.endDate || '').split('T')[0];
          if (isActive && s <= todayStr && e >= todayStr) {
            if (r.employee?.id)    ids.add(String(r.employee.id));
            if (r.employeeId)      ids.add(String(r.employeeId));
            if (r.employeeName)    names.add(String(r.employeeName).toLowerCase().trim());
          }
        });

        // Also match by name for robustness (backend may not always return employeeId)
        const finalIds = new Set<string>(ids);
        state.employees.forEach(emp => {
          if (names.has(emp.name.toLowerCase().trim())) {
            finalIds.add(String(emp.id));
          }
        });

        setOnLeaveIds(finalIds);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [state.employees]);
  
  // Drawer/Modal States
  const [formOpen, setFormOpen] = useState(false);
  const [viewEmp, setViewEmp] = useState<AdminEmployee | null>(null);
  const [editEmp, setEditEmp] = useState<AdminEmployee | null>(null);
  const [deleteId, setDeleteId] = useState<number | string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ entityType: string; entityId: string; name: string } | null>(null);
  
  // Form State & Validation / Loaders
  const [form, setForm] = useState<Omit<AdminEmployee, 'id'> & { id?: number | string }>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss Toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Filter bar: only departments that actually have employees, so filtering by
  // an empty department isn't offered. Add/Edit form: full canonical list (see
  // departmentOptions below) so a department can be picked before anyone's
  // assigned to it yet.
  const departments = [...new Set(state.employees.map(e => e.department))];
  const departmentOptions = Array.from(new Set([...CANONICAL_DEPARTMENT_NAMES, ...departments])).sort();
  const countries = ['Lebanon', 'United Arab Emirates', 'Saudi Arabia', 'United Kingdom', 'France', 'Tunisia', 'Canada'];

  // Compute effective status: employees on leave today show as 'on_leave'
  const employeesWithEffectiveStatus = state.employees.map(e => ({
    ...e,
    status: (e.status === 'active' && onLeaveIds.has(String(e.id))) ? 'on_leave' as AdminEmployee['status'] : e.status
  }));

  const filtered = employeesWithEffectiveStatus.filter(e => {
    const q = search.toLowerCase();
    return (
      (e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.position.toLowerCase().includes(q)) &&
      (!filterDept    || e.department === filterDept) &&
      (!filterCountry || e.country === filterCountry) &&
      (!filterStatus  || e.status === filterStatus)
    );
  });

  function openAdd() { 
    setForm(emptyForm()); 
    setEditEmp(null); 
    setErrors({});
    setFormOpen(true); 
  }
  
  function openEdit(emp: AdminEmployee) { 
    setForm({ 
      ...emp,
      role: emp.role || 'Employee',
      division: emp.division || 'Levant',
      approvalLevelId: emp.approvalLevelId || 'app-1'
    }); 
    setEditEmp(emp); 
    setErrors({});
    setFormOpen(true); 
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    
    if (!form.name.trim()) newErrors.name = 'Full name is required';
    
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!form.position.trim()) newErrors.position = 'Position is required';
    if (!form.hireDate) newErrors.hireDate = 'Hire date is required';
    if (!form.division?.trim()) newErrors.division = 'Division is required';
    
    if (editEmp && form.managerId === editEmp.id) {
      newErrors.manager = 'Employee cannot be their own manager';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      if (editEmp) {
        const payload = toBackendEmployeePayload(form);
        const res = await updateEmployee(String(editEmp.id), payload);
        const mapped = toAdminEmployee(res);
        dispatch({ type: 'UPDATE_EMPLOYEE', payload: mapped });
        setToast({ message: `Successfully updated ${form.name}`, type: 'success' });
      } else {
        const payload = toBackendEmployeePayload(form);
        const { status, ...createPayload } = payload;
        console.log('Sending create payload without status:', createPayload);
        const res = await createEmployee(createPayload);
        const mapped = toAdminEmployee(res);
        dispatch({ type: 'ADD_EMPLOYEE', payload: mapped });
        setToast({ message: `Successfully added ${form.name}`, type: 'success' });
      }
      setFormOpen(false);
    } catch (err: any) {
      console.error(err);
      setToast({ message: err?.message || 'Failed to save employee', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleStatus(emp: AdminEmployee) {
    const next = emp.status === 'active' ? 'inactive' : emp.status === 'inactive' ? 'active' : emp.status === 'archived' ? 'active' : 'archived';
    
    let backendStatus = 'ACTIVE';
    if (next === 'inactive') backendStatus = 'INACTIVE';
    if (next === 'archived') backendStatus = 'ARCHIVED';

    try {
      const res = await updateEmployee(String(emp.id), { status: backendStatus } as any);
      const mapped = toAdminEmployee(res);
      dispatch({ type: 'UPDATE_EMPLOYEE', payload: mapped });
      setToast({ message: `Status updated for ${emp.name}`, type: 'success' });
    } catch (err: any) {
      console.error(err);
      setToast({ message: err?.message || 'Failed to update status', type: 'error' });
    }
  }

  const managers = state.employees.filter(e => e.id !== editEmp?.id);

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 relative">
      
      {/* Toast Alert Banner */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg transition-all duration-300 animate-slide-in ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300' : 'bg-red-50 border-red-100 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Employee Management</h1>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} of {state.employees.length} employees</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors cursor-pointer">
          <Plus size={16} /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48"><SearchInput value={search} onChange={setSearch} placeholder="Search name, email, position..." /></div>
        <SelectFilter label="Department" value={filterDept}    onChange={setFilterDept}    options={departmentOptions.map(d => ({ label: d, value: d }))} />
        <SelectFilter label="Country"    value={filterCountry} onChange={setFilterCountry} options={countries.map(c => ({ label: c, value: c }))} />
        <SelectFilter label="Status"     value={filterStatus}  onChange={setFilterStatus}  options={[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }, { label: 'On Leave', value: 'on_leave' }, { label: 'Archived', value: 'archived' }]} />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-[11px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50/50">
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Role / Department</th>
                <th className="py-3.5 px-4">Position</th>
                <th className="py-3.5 px-4">Country</th>
                <th className="py-3.5 px-4">Manager</th>
                <th className="py-3.5 px-4">Hired</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-16 text-center text-slate-400 text-sm">No employees found</td></tr>
              )}
              {filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(emp => {
                const mgr = state.employees.find(m => m.id === emp.managerId);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-violet-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                          {emp.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{emp.name}</p>
                          <p className="text-[11px] text-slate-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                      <div className="font-bold text-slate-700 dark:text-slate-300">{emp.role || 'Employee'}</div>
                      <div className="text-[10px] text-slate-400">{emp.department}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-xs max-w-32 truncate">{emp.position}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      <div>{emp.country}</div>
                      <div className="text-[10px] text-slate-400">{emp.division || 'Levant'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-xs">{mgr?.name ?? '—'}</td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-xs">{new Date(emp.hireDate).toLocaleDateString('en-GB', { month:'short', year:'numeric' })}</td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={emp.status as any} />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setHistoryTarget({ entityType: 'Employee', entityId: String(emp.id), name: emp.name })} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer" title="Audit History"><History size={14}/></button>
                        <button onClick={() => setViewEmp(emp)} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer" title="View"><Eye size={14}/></button>
                        <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer" title="Edit"><Edit2 size={14}/></button>
                        <button onClick={() => toggleStatus(emp)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer" title="Toggle Status">
                          {emp.status === 'active' ? <Archive size={14}/> : <UserCheck size={14}/>}
                        </button>
                        <button onClick={() => setDeleteId(emp.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer" title="Delete"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {/* View Drawer */}
      <SlideDrawer isOpen={!!viewEmp} onClose={() => setViewEmp(null)} title={viewEmp?.name ?? ''} subtitle={viewEmp?.position}>
        {viewEmp && (
          <div className="p-6 flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-400 to-indigo-500 rounded-2xl flex items-center justify-center text-white text-xl font-black">
                {viewEmp.name.split(' ').map(n => n[0]).join('').slice(0,2)}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-lg">{viewEmp.name}</h3>
                <p className="text-slate-500 text-sm">{viewEmp.position} · {viewEmp.department}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded font-bold uppercase">{viewEmp.role || 'Employee'}</span>
                  <StatusBadge status={viewEmp.status as any} />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Email', viewEmp.email],
                ['Phone', viewEmp.phone || '—'],
                ['Division', viewEmp.division || 'Levant'],
                ['Country', viewEmp.country],
                ['Unit', viewEmp.unit || '—'],
                ['Schedule', viewEmp.workingSchedule],
                ['Hire Date', new Date(viewEmp.hireDate).toLocaleDateString('en-GB')],
                ['Manager', state.employees.find(m => m.id === viewEmp.managerId)?.name ?? '—'],
                ['Leave Policy', state.policies.find(p => p.id === viewEmp.policyId)?.policyName ?? '—'],
                ['Approval Config', state.approvalLevels.find(a => a.id === viewEmp.approvalLevelId)?.name ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5 truncate">{value}</p>
                </div>
              ))}
            </div>

            {/* Leave Balances */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Leave Balances</h4>
              <div className="grid grid-cols-2 gap-2">
                {state.leaveBalances.filter(b => b.employeeId === viewEmp.id).map(b => (
                  <div key={b.leaveType} className="bg-slate-50 dark:bg-slate-700 rounded-xl p-2.5 flex justify-between items-center">
                    <span className="text-[11px] text-slate-500 capitalize">{b.leaveType.replace('_',' ')}</span>
                    <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{b.amount}d</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setViewEmp(null); openEdit(viewEmp); }} className="flex-1 bg-violet-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-violet-700 transition-colors cursor-pointer">Edit Employee</button>
              <button onClick={() => setViewEmp(null)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl text-sm hover:bg-slate-200 transition-colors cursor-pointer">Close</button>
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* Add/Edit Form Drawer */}
      <SlideDrawer isOpen={formOpen} onClose={() => setFormOpen(false)} title={editEmp ? 'Edit Employee' : 'Add New Employee'} subtitle={editEmp ? `Editing ${editEmp.name}` : 'Fill in employee details'}>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Full Name *', key: 'name', type: 'text' },
              { label: 'Email *',     key: 'email', type: 'email' },
              { label: 'Phone',     key: 'phone', type: 'text' },
              { label: 'Position (Job Title) *',  key: 'position', type: 'text' },
              { label: 'Division / Branch *', key: 'division', type: 'text' },
              { label: 'Unit / Team', key: 'unit', type: 'text' },
              { label: 'Hire Date *', key: 'hireDate', type: 'date' },
            ].map(f => (
              <div key={f.key} className={f.key === 'name' ? 'col-span-2' : ''}>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{f.label}</label>
                <input type={f.type} value={(form as any)[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className={`w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border ${errors[f.key] ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500`} />
                {errors[f.key] && (
                  <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={10} /> {errors[f.key]}</p>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">User Role</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="Employee">Employee</option>
                <option value="Manager">Manager</option>
                <option value="HR Admin">HR Admin</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department</label>
              <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500">
                {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Manager</label>
              <select value={form.managerId ?? ''} onChange={e => setForm(p => ({ ...p, managerId: e.target.value ? e.target.value : undefined }))} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">No Manager</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {errors.manager && <p className="text-red-500 text-[10px] mt-1">{errors.manager}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country</label>
              <select value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value, countryCode: e.target.value === 'France' ? 'FR' : e.target.value === 'Lebanon' ? 'LB' : e.target.value === 'Tunisia' ? 'TN' : e.target.value === 'Canada' ? 'CA' : 'AE' }))} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500">
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Leave Policy</label>
              <select value={form.policyId} onChange={e => setForm(p => ({ ...p, policyId: e.target.value }))} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500">
                {state.policies.map(pol => <option key={pol.id} value={pol.id}>{pol.flag} {pol.policyName}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Approval Levels Configuration</label>
              <select value={form.approvalLevelId} onChange={e => setForm(p => ({ ...p, approvalLevelId: e.target.value }))} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500">
                {state.approvalLevels.map(lvl => <option key={lvl.id} value={lvl.id}>{lvl.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Schedule</label>
              <select value={form.workingSchedule} onChange={e => setForm(p => ({ ...p, workingSchedule: e.target.value as any }))} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="remote">Remote</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Employment Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer">Cancel</button>
            <button type="submit" disabled={isLoading} className="flex-1 py-2.5 text-sm font-bold text-white bg-violet-600 rounded-xl hover:bg-violet-700 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                editEmp ? 'Save Changes' : 'Add Employee'
              )}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            try {
              await deleteEmployee(String(deleteId));
              const empName = state.employees.find(e => e.id === deleteId)?.name;
              dispatch({ type: 'DELETE_EMPLOYEE', payload: deleteId });
              setToast({ message: `Successfully deleted ${empName}`, type: 'success' });
            } catch (err: any) {
              console.error(err);
              setToast({ message: err?.message || 'Failed to delete employee', type: 'error' });
            } finally {
              setDeleteId(null);
            }
          }
        }}
        title="Delete Employee"
        message={`Are you sure you want to permanently delete ${state.employees.find(e => e.id === deleteId)?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
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
