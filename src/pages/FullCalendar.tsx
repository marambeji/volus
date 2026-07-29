import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, RefreshCw, X, Calendar as CalendarIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/apiClient';
import { getLeaveTypes, type LeaveTypeItem } from '../services/leaveTypesApi';
import { getEmployees, type BackendEmployee } from '../services/employeesApi';

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

export default function FullCalendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('All');
  
  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);

  // Modal state for viewing all absences on a specific date when clicking +X more
  const [activeDayModal, setActiveDayModal] = useState<{
    dateString: string;
    dayNumber: number;
    absences: Array<{ employeeName: string; leaveLabel: string; color: string }>;
  } | null>(null);

  // Load backend data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [whosOut, types, emps] = await Promise.all([
          apiFetch<any[]>('/leave-requests/whos-out').catch(() => []),
          getLeaveTypes().catch(() => []),
          getEmployees({ limit: 200 }).catch(() => []),
        ]);
        setLeaveRequests(Array.isArray(whosOut) ? whosOut : []);
        setLeaveTypes(Array.isArray(types) ? types : []);
        setEmployees(Array.isArray(emps) ? emps : []);
      } catch (err) {
        console.error('Error loading calendar data:', err);
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Total days in month
  const totalDays = new Date(year, month + 1, 0).getDate();
  // Starting day index of month (0 = Sunday, 1 = Monday...)
  const startDayIndex = new Date(year, month, 1).getDay();

  // Create dates array
  const dayCells: Array<{ dayNumber: number; isCurrentMonth: boolean; dateString: string }> = [];
  
  // Previous month padding cells
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  for (let i = startDayIndex - 1; i >= 0; i--) {
    const prevDay = prevMonthTotalDays - i;
    const prevMonthNum = month === 0 ? 12 : month;
    const prevYearNum = month === 0 ? year - 1 : year;
    const dateStr = `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
    dayCells.push({
      dayNumber: prevDay,
      isCurrentMonth: false,
      dateString: dateStr,
    });
  }

  // Current month cells
  for (let i = 1; i <= totalDays; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dayCells.push({
      dayNumber: i,
      isCurrentMonth: true,
      dateString: dateStr,
    });
  }

  // Next month padding cells to complete 35 or 42 grid cells
  const totalCellsSoFar = dayCells.length;
  const remainingCells = (totalCellsSoFar <= 35 ? 35 : 42) - totalCellsSoFar;
  for (let i = 1; i <= remainingCells; i++) {
    const nextMonthNum = month === 11 ? 1 : month + 2;
    const nextYearNum = month === 11 ? year + 1 : year;
    const dateStr = `${nextYearNum}-${String(nextMonthNum).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dayCells.push({
      dayNumber: i,
      isCurrentMonth: false,
      dateString: dateStr,
    });
  }

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
    const matching = leaveRequests.filter((req) => {
      // Filter by employee if selected
      if (selectedEmployeeFilter !== 'All' && req.employeeId !== selectedEmployeeFilter) {
        return false;
      }

      const startDate = req.startDate ? req.startDate.split('T')[0] : '';
      const endDate = req.endDate ? req.endDate.split('T')[0] : '';

      if (!startDate || !endDate) return false;
      return startDate <= dateStr && endDate >= dateStr;
    });

    // Deduplicate by employeeName + leaveLabel
    const seen = new Set<string>();
    const deduplicated: Array<{ employeeName: string; leaveLabel: string; color: string }> = [];

    for (const req of matching) {
      const empName = req.employeeName || 'Employee';
      const typeItem = leaveTypes.find(
        (lt) => lt.id === req.leaveTypeId || lt.label.toLowerCase() === (req.leaveTypeName || '').toLowerCase()
      );
      const leaveLabel = req.leaveTypeName || typeItem?.label || 'Leave';
      const key = `${empName.toLowerCase()}_${leaveLabel.toLowerCase()}`;

      if (!seen.has(key)) {
        seen.add(key);
        const color = getTypeColor(typeItem?.key || '', req.leaveTypeName || '', typeItem?.color);
        deduplicated.push({
          employeeName: empName,
          leaveLabel: leaveLabel,
          color: color,
        });
      }
    }
    return deduplicated;
  }

  function handlePrevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function handleNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  return (
    <div className="bg-slate-50 min-h-screen p-6">
      {/* ── Header Toolbar ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          Home
        </button>

        <div className="flex items-center gap-4 justify-center">
          <button onClick={handlePrevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            {currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            {loading && <Loader2 size={16} className="animate-spin text-violet-600" />}
          </h2>
          <button onClick={handleNextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <ChevronRight size={20} />
          </button>
        </div>

        <select
          value={selectedEmployeeFilter}
          onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <option value="All">All Employees</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.fullName}</option>
          ))}
        </select>
      </div>

      {/* ── Calendar Grid ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-slate-100 text-center bg-slate-50">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
            <div key={day} className="py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-r last:border-r-0 border-slate-100">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {dayCells.map((cell, idx) => {
            const absences = getAbsencesForDate(cell.dateString);
            const visibleAbsences = absences.slice(0, 2);
            const extraCount = absences.length - visibleAbsences.length;

            return (
              <div
                key={idx}
                className={`h-28 p-2 flex flex-col justify-between overflow-hidden transition-all ${
                  cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50 text-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold ${cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-300'}`}>
                    {cell.dayNumber}
                  </span>
                </div>

                {/* Absence list */}
                <div className="flex-1 flex flex-col gap-1 overflow-hidden mt-1">
                  {visibleAbsences.map((abs, aIdx) => (
                    <div
                      key={aIdx}
                      onClick={() => setActiveDayModal({ dateString: cell.dateString, dayNumber: cell.dayNumber, absences })}
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
                      onClick={() => setActiveDayModal({ dateString: cell.dateString, dayNumber: cell.dayNumber, absences })}
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

      {/* ── Day Details Modal (Opens when clicking +X more) ── */}
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
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white text-slate-600 border border-slate-200 shadow-2xs">
                    {abs.leaveLabel}
                  </span>
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

