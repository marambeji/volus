import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X, Calendar as CalendarIcon, Search, Users, ChevronDown } from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import { getLeaveTypes, type LeaveTypeItem } from '../services/leaveTypesApi';

const DEFAULT_TYPE_COLORS: Record<string, string> = {
  annual: '#3B82F6',
  sick: '#8B5CF6',
  bereavement: '#EF4444',
  wedding: '#10B981',
  paternity: '#6B7280',
  maternity: '#EC4899',
  public_holiday: '#22C55E',
  holiday: '#22C55E',
  compensation: '#06B6D4',
  unpaid: '#1E3A8A',
  overtime: '#B91C1C',
  seq: '#F59E0B',
};

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type ViewMode = 'day' | 'week' | 'month' | 'year';

interface CalendarEmployee {
  id: string;
  fullName: string;
  department: string;
}

interface CalendarAbsence {
  requestId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  dayPortion?: string;
  status: string;
}

function dayPortionLabel(dayPortion?: string): string | null {
  if (dayPortion === 'FIRST_HALF') return 'First Half';
  if (dayPortion === 'SECOND_HALF') return 'Second Half';
  return null;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

export default function FullCalendar() {
  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('All');
  // Multi-person custom filter
  const [customEmployeeIds, setCustomEmployeeIds] = useState<Set<string>>(new Set());
  const [customSearch, setCustomSearch] = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const customPickerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [absences, setAbsences] = useState<CalendarAbsence[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [employees, setEmployees] = useState<CalendarEmployee[]>([]);

  // Company-wide scope data (lazy-loaded when "All Employees" or "Custom Filter" is selected)
  const [allScopeLoaded, setAllScopeLoaded] = useState(false);
  const [allAbsences, setAllAbsences] = useState<CalendarAbsence[]>([]);
  const [allEmployees, setAllEmployees] = useState<CalendarEmployee[]>([]);

  // Modal state for viewing all absences on a specific date
  const [activeDayModal, setActiveDayModal] = useState<{
    dateString: string;
    absences: Array<{ employeeName: string; leaveLabel: string; color: string; dayPortion?: string }>;
  } | null>(null);

  // Load initial backend data (defaults to My Circle / Team scope)
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [calendar, types] = await Promise.all([
          apiFetch<{ scope: string; employees: CalendarEmployee[]; absences: CalendarAbsence[] }>('/leave-requests/calendar'),
          getLeaveTypes().catch(() => []),
        ]);
        setEmployees(calendar.employees || []);
        setAbsences(calendar.absences || []);
        setLeaveTypes(Array.isArray(types) ? types : []);
      } catch (err) {
        console.error('Error loading calendar data:', err);
        setEmployees([]);
        setAbsences([]);
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  // Fetch company-wide data when "All Employees" or "Custom Filter" is selected
  useEffect(() => {
    if ((selectedEmployeeFilter === 'All' || selectedEmployeeFilter === 'custom') && !allScopeLoaded) {
      async function loadAllScope() {
        setLoading(true);
        try {
          const res = await apiFetch<{ scope: string; employees: CalendarEmployee[]; absences: CalendarAbsence[] }>('/leave-requests/calendar?scope=all');
          setAllEmployees(res.employees || []);
          setAllAbsences(res.absences || []);
          setAllScopeLoaded(true);
        } catch (err) {
          console.error('Error loading all-scope calendar:', err);
        } finally {
          setLoading(false);
        }
      }
      void loadAllScope();
    }
  }, [selectedEmployeeFilter, allScopeLoaded]);

  // Close custom picker when clicking outside
  useEffect(() => {
    if (!showCustomPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (customPickerRef.current && !customPickerRef.current.contains(e.target as Node)) {
        setShowCustomPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomPicker]);

  function getTypeColor(key: string, label: string, color?: string): string {
    if (color && color !== '#3B82F6') return color;
    const k = (key || '').toLowerCase();
    const l = (label || '').toLowerCase();
    for (const [typeKey, hexColor] of Object.entries(DEFAULT_TYPE_COLORS)) {
      if (k.includes(typeKey) || l.includes(typeKey)) return hexColor;
    }
    return color || '#3B82F6';
  }

  // Get absences for a specific date (deduplicated & formatted)
  function getAbsencesForDate(dateStr: string) {
    const isAllScope = selectedEmployeeFilter === 'All' || selectedEmployeeFilter === 'custom';
    const activeAbsences = isAllScope && allScopeLoaded ? allAbsences : (absences.length > 0 ? absences : allAbsences);

    const matching = activeAbsences.filter((req) => {
      if ((req.status || '').toUpperCase() !== 'APPROVED') return false;
      if (selectedEmployeeFilter === 'custom' && customEmployeeIds.size > 0) {
        if (!customEmployeeIds.has(req.employeeId)) return false;
      }
      const s = req.startDate ? req.startDate.split('T')[0] : '';
      const e = req.endDate ? req.endDate.split('T')[0] : '';
      if (!s || !e) return false;
      return s <= dateStr && e >= dateStr;
    });

    const seen = new Set<string>();
    const deduplicated: Array<{ employeeName: string; leaveLabel: string; color: string; dayPortion?: string }> = [];

    for (const req of matching) {
      const empName = req.employeeName || 'Employee';
      const typeItem = leaveTypes.find(
        (lt) => lt.id === req.leaveTypeId || lt.label.toLowerCase() === (req.leaveTypeName || '').toLowerCase()
      );
      const leaveLabel = req.leaveTypeName || typeItem?.label || 'Leave';
      const key = `${empName.toLowerCase()}_${leaveLabel.toLowerCase()}_${req.dayPortion || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push({ employeeName: empName, leaveLabel, color: getTypeColor(typeItem?.key || '', req.leaveTypeName || '', typeItem?.color), dayPortion: req.dayPortion });
      }
    }
    return deduplicated;
  }

  // ── Navigation (granularity depends on the active view) ──────────────────
  function handlePrev() {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else if (view === 'month') d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    setCurrentDate(d);
  }
  function handleNext() {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else if (view === 'month') d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    setCurrentDate(d);
  }
  function handleToday() {
    setCurrentDate(new Date());
  }

  const headerLabel = useMemo(() => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (view === 'week') {
      const start = startOfWeek(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const sameMonth = start.getMonth() === end.getMonth();
      const startLabel = `${MONTH_LABELS[start.getMonth()].slice(0, 3)} ${start.getDate()}`;
      const endLabel = sameMonth
        ? `${end.getDate()}, ${end.getFullYear()}`
        : `${MONTH_LABELS[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
      return `${startLabel} – ${endLabel}`;
    }
    if (view === 'year') return String(currentDate.getFullYear());
    return currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [view, currentDate]);

  function openDayModal(dateStr: string) {
    const dayAbsences = getAbsencesForDate(dateStr);
    if (dayAbsences.length === 0) return;
    setActiveDayModal({ dateString: dateStr, absences: dayAbsences });
  }

  // ── Month grid (also used to build a week's row) ──────────────────────────
  function buildMonthCells(year: number, month: number) {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startDayIndex = new Date(year, month, 1).getDay();
    const cells: Array<{ dayNumber: number; isCurrentMonth: boolean; dateString: string }> = [];

    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const prevDay = prevMonthTotalDays - i;
      const prevMonthNum = month === 0 ? 12 : month;
      const prevYearNum = month === 0 ? year - 1 : year;
      cells.push({ dayNumber: prevDay, isCurrentMonth: false, dateString: `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}` });
    }
    for (let i = 1; i <= totalDays; i++) {
      cells.push({ dayNumber: i, isCurrentMonth: true, dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}` });
    }
    const remainingCells = (cells.length <= 35 ? 35 : 42) - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonthNum = month === 11 ? 1 : month + 2;
      const nextYearNum = month === 11 ? year + 1 : year;
      cells.push({ dayNumber: i, isCurrentMonth: false, dateString: `${nextYearNum}-${String(nextMonthNum).padStart(2, '0')}-${String(i).padStart(2, '0')}` });
    }
    return cells;
  }

  const monthDayCells = useMemo(
    () => buildMonthCells(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  const weekDayCells = useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return { date: d, dateString: toDateStr(d) };
    });
  }, [currentDate]);

  const employeeOptions = employees;

  return (
    <div className="bg-slate-50 min-h-screen p-6">
      {/* ── Header Toolbar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-shrink-0">
          {(['day', 'week', 'month', 'year'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wide rounded-lg transition-colors cursor-pointer ${view === v ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'
                }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 justify-center flex-wrap">
          <button onClick={handleToday} className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-violet-600 border border-slate-200 rounded-lg hover:border-violet-300 transition-colors cursor-pointer">
            Today
          </button>
          <button onClick={handlePrev} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 whitespace-nowrap">
            {headerLabel}
            {loading && <Loader2 size={16} className="animate-spin text-violet-600" />}
          </h2>
          <button onClick={handleNext} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end flex-shrink-0">
          <select
            value={selectedEmployeeFilter}
            onChange={(e) => {
              setSelectedEmployeeFilter(e.target.value);
              if (e.target.value !== 'custom') {
                setCustomEmployeeIds(new Set());
                setShowCustomPicker(false);
                setCustomSearch('');
              }
            }}
            className="px-3.5 py-2 text-sm font-semibold bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer shadow-xs"
          >
            <option value="All">All Employees</option>
            <option value="circle">My Circle</option>
            <option value="custom">Custom Filter</option>
          </select>

          {/* ── Custom multi-person picker ── */}
          {selectedEmployeeFilter === 'custom' && (() => {
            const listForPicker = allScopeLoaded ? allEmployees : employees;
            const filtered = listForPicker.filter((e) =>
              e.fullName.toLowerCase().includes(customSearch.toLowerCase()) ||
              e.department?.toLowerCase().includes(customSearch.toLowerCase())
            );
            const selectedCount = customEmployeeIds.size;
            const pickerLabel = selectedCount === 0
              ? 'Select people…'
              : selectedCount === 1
                ? listForPicker.find((e) => customEmployeeIds.has(e.id))?.fullName ?? `${selectedCount} selected`
                : `${selectedCount} people selected`;

            return (
              <div ref={customPickerRef} className="relative">
                {/* Trigger button */}
                <button
                  type="button"
                  onClick={() => setShowCustomPicker((v) => !v)}
                  className={`flex items-center gap-2 pl-3 pr-2.5 py-2 text-sm font-semibold border rounded-xl cursor-pointer transition-all shadow-xs ${
                    selectedCount > 0
                      ? 'bg-violet-50 border-violet-300 text-violet-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300'
                  }`}
                >
                  <Users size={14} className={selectedCount > 0 ? 'text-violet-500' : 'text-slate-400'} />
                  <span className="max-w-[160px] truncate">{pickerLabel}</span>
                  {selectedCount > 0 && (
                    <span className="bg-violet-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {selectedCount}
                    </span>
                  )}
                  <ChevronDown size={13} className="text-slate-400" />
                </button>

                {showCustomPicker && (
                  <div
                    className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Search */}
                    <div className="p-3 border-b border-slate-100">
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                        <Search size={13} className="text-slate-400 flex-shrink-0" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search people…"
                          value={customSearch}
                          onChange={(e) => setCustomSearch(e.target.value)}
                          className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
                        />
                        {customSearch && (
                          <button onClick={() => setCustomSearch('')} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Select all / clear */}
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => setCustomEmployeeIds(new Set(listForPicker.map((e) => e.id)))}
                        className="text-[11px] font-bold text-violet-600 hover:text-violet-800 cursor-pointer"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomEmployeeIds(new Set())}
                        className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>

                    {/* Employee list */}
                    <div className="overflow-y-auto max-h-64" style={{ scrollbarWidth: 'thin' }}>
                      {filtered.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-400">No employees found</div>
                      ) : (
                        filtered.map((emp) => {
                          const checked = customEmployeeIds.has(emp.id);
                          return (
                            <label
                              key={emp.id}
                              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-slate-50 ${
                                checked ? 'bg-violet-50' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setCustomEmployeeIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(emp.id)) next.delete(emp.id);
                                    else next.add(emp.id);
                                    return next;
                                  });
                                }}
                                className="accent-violet-600 w-4 h-4 rounded flex-shrink-0"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className={`text-sm font-semibold truncate ${
                                  checked ? 'text-violet-700' : 'text-slate-700'
                                }`}>{emp.fullName}</span>
                                {emp.department && (
                                  <span className="text-[11px] text-slate-400 truncate">{emp.department}</span>
                                )}
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>

                    {/* Done footer */}
                    <div className="p-2.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowCustomPicker(false)}
                        className="w-full py-2 text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors cursor-pointer"
                      >
                        Done{selectedCount > 0 ? ` (${selectedCount} selected)` : ''}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Month View ── */}
      {view === 'month' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
          <div className="grid grid-cols-7 border-b border-slate-100 text-center bg-slate-50">
            {WEEKDAY_LABELS.map((day) => (
              <div key={day} className="py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-r last:border-r-0 border-slate-100">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {monthDayCells.map((cell, idx) => {
              const dayAbsences = getAbsencesForDate(cell.dateString);
              const visible = dayAbsences.slice(0, 2);
              const extraCount = dayAbsences.length - visible.length;
              return (
                <div key={idx} className={`h-28 p-2 flex flex-col justify-between overflow-hidden transition-all ${cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50 text-slate-300'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-bold ${cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-300'}`}>{cell.dayNumber}</span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1 overflow-hidden mt-1">
                    {visible.map((abs, aIdx) => (
                      <div
                        key={aIdx}
                        onClick={() => openDayModal(cell.dateString)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold text-white truncate shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: abs.color }}
                        title={`${abs.employeeName} (${abs.leaveLabel})`}
                      >
                        {abs.employeeName}
                      </div>
                    ))}
                    {extraCount > 0 && (
                      <button
                        type="button"
                        onClick={() => openDayModal(cell.dateString)}
                        className="text-[9px] font-bold text-slate-600 bg-slate-100 hover:bg-violet-100 hover:text-violet-700 px-1.5 py-0.5 rounded w-max transition-colors cursor-pointer"
                      >
                        +{extraCount} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Week View ── */}
      {view === 'week' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
          <div className="grid grid-cols-7 divide-x divide-slate-100">
            {weekDayCells.map(({ date, dateString }) => {
              const dayAbsences = getAbsencesForDate(dateString);
              const isToday = dateString === toDateStr(new Date());
              return (
                <div key={dateString} className="min-h-[260px] flex flex-col">
                  <div className={`py-3 text-center border-b border-slate-100 ${isToday ? 'bg-violet-50' : 'bg-slate-50'}`}>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{WEEKDAY_LABELS[date.getDay()].slice(0, 3)}</div>
                    <div className={`text-sm font-bold ${isToday ? 'text-violet-600' : 'text-slate-700'}`}>{date.getDate()}</div>
                  </div>
                  <div className="flex-1 p-2 flex flex-col gap-1.5 overflow-y-auto">
                    {dayAbsences.length === 0 && <p className="text-[10px] text-slate-300 text-center mt-4">No absences</p>}
                    {dayAbsences.map((abs, aIdx) => (
                      <div
                        key={aIdx}
                        onClick={() => openDayModal(dateString)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold text-white shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: abs.color }}
                        title={`${abs.employeeName} (${abs.leaveLabel})`}
                      >
                        <div className="truncate">{abs.employeeName}</div>
                        <div className="text-[9px] font-medium opacity-90 truncate">{abs.leaveLabel}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Day View ── */}
      {view === 'day' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6 p-5">
          {(() => {
            const dateString = toDateStr(currentDate);
            const dayAbsences = getAbsencesForDate(dateString);
            if (dayAbsences.length === 0) {
              return (
                <div className="py-16 text-center">
                  <CalendarIcon className="mx-auto text-slate-200 mb-3" size={40} />
                  <p className="text-sm font-semibold text-slate-400">No absences on this day</p>
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {dayAbsences.map((abs, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100/80">
                    <div className="flex items-center gap-3">
                      <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-xs" style={{ backgroundColor: abs.color }} />
                      <span className="text-sm font-bold text-slate-800">{abs.employeeName}</span>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white text-slate-600 border border-slate-200 shadow-2xs">{abs.leaveLabel}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Year View ── */}
      {view === 'year' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {MONTH_LABELS.map((label, monthIdx) => {
            const cells = buildMonthCells(currentDate.getFullYear(), monthIdx);
            return (
              <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => { setCurrentDate(new Date(currentDate.getFullYear(), monthIdx, 1)); setView('month'); }}
                  className="w-full py-2.5 text-xs font-bold text-slate-700 bg-slate-50 border-b border-slate-100 hover:bg-violet-50 hover:text-violet-700 transition-colors cursor-pointer"
                >
                  {label}
                </button>
                <div className="grid grid-cols-7 text-center px-2 pt-2">
                  {WEEKDAY_LABELS.map((d) => (
                    <div key={d} className="text-[8px] font-bold text-slate-300 pb-1">{d[0]}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1 px-2 pb-3">
                  {cells.map((cell, idx) => {
                    const count = cell.isCurrentMonth ? getAbsencesForDate(cell.dateString).length : 0;
                    return (
                      <button
                        key={idx}
                        onClick={() => cell.isCurrentMonth && openDayModal(cell.dateString)}
                        className={`text-[9px] h-6 w-6 mx-auto rounded-full flex items-center justify-center transition-colors ${!cell.isCurrentMonth
                            ? 'text-slate-200 cursor-default'
                            : count > 0
                              ? 'bg-violet-100 text-violet-700 font-bold hover:bg-violet-200 cursor-pointer'
                              : 'text-slate-500 hover:bg-slate-50 cursor-default'
                          }`}
                        title={count > 0 ? `${count} absence(s)` : undefined}
                      >
                        {cell.dayNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Legend ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Leave Categories Legend</h3>
        <div className="flex flex-wrap gap-4">
          {(leaveTypes.length > 0 ? leaveTypes : [
            { id: '1', key: 'annual', label: 'Annual Leave', trackingMode: 'AVAILABLE_BALANCE', color: '#3B82F6', displayOrder: 1 },
            { id: '2', key: 'sick', label: 'Sick Leave', trackingMode: 'AVAILABLE_BALANCE', color: '#8B5CF6', displayOrder: 2 },
            { id: '3', key: 'bereavement', label: 'Bereavement Leave', trackingMode: 'AVAILABLE_BALANCE', color: '#EF4444', displayOrder: 3 },
            { id: '4', key: 'paternity', label: 'Paternity Leave', trackingMode: 'USAGE_YTD', color: '#6B7280', displayOrder: 4 },
            { id: '5', key: 'maternity', label: 'Maternity Leave', trackingMode: 'USAGE_YTD', color: '#EC4899', displayOrder: 5 },
            { id: '6', key: 'public_holiday', label: 'Public Holiday', trackingMode: 'AVAILABLE_BALANCE', color: '#22C55E', displayOrder: 6 },
            { id: '7', key: 'compensation', label: 'Compensation Leave', trackingMode: 'AVAILABLE_BALANCE', color: '#06B6D4', displayOrder: 7 },
            { id: '8', key: 'unpaid', label: 'Unpaid Leave', trackingMode: 'AVAILABLE_BALANCE', color: '#1E3A8A', displayOrder: 8 },
            { id: '9', key: 'overtime', label: 'Overtime Leave', trackingMode: 'AVAILABLE_BALANCE', color: '#B91C1C', displayOrder: 9 },
          ]).map((type) => {
            const color = getTypeColor(type.key, type.label, type.color);
            return (
              <div key={type.key || type.id} className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border border-white shadow-xs flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs font-medium text-slate-600">{type.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Day Details Modal ── */}
      {activeDayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                  <CalendarIcon size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Absences on {new Date(activeDayModal.dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {activeDayModal.absences.length} employee{activeDayModal.absences.length !== 1 ? 's' : ''} on leave
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveDayModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {activeDayModal.absences.map((abs, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100/80">
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-xs" style={{ backgroundColor: abs.color }} />
                    <span className="text-sm font-bold text-slate-800">{abs.employeeName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white text-slate-600 border border-slate-200 shadow-2xs">
                      {abs.leaveLabel}
                    </span>
                    {dayPortionLabel(abs.dayPortion) && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700 px-1.5 py-1 rounded-lg">
                        {dayPortionLabel(abs.dayPortion)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveDayModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
