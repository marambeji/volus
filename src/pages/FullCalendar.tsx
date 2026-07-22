import { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { leaveTypesList, employeesList, leaveRequestsList } from '../data/mockData';

export default function FullCalendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 8)); // July 2026
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('All');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get total days in month
  const totalDays = new Date(year, month + 1, 0).getDate();
  // Get starting day index of the month (0 = Sunday, 1 = Monday, etc.)
  const startDayIndex = new Date(year, month, 1).getDay();

  // Create dates array
  const dayCells = [];
  // Previous month padding cells
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  for (let i = startDayIndex - 1; i >= 0; i--) {
    dayCells.push({
      dayNumber: prevMonthTotalDays - i,
      isCurrentMonth: false,
      dateString: `${year}-${String(month).padStart(2, '0')}-${String(prevMonthTotalDays - i).padStart(2, '0')}`
    });
  }
  // Current month cells
  for (let i = 1; i <= totalDays; i++) {
    dayCells.push({
      dayNumber: i,
      isCurrentMonth: true,
      dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    });
  }

  // Get absences for a specific date
  function getAbsencesForDate(dateStr: string) {
    return leaveRequestsList
      .filter((req) => {
        // Filter by employee if selected
        if (selectedEmployeeFilter !== 'All' && req.employeeId.toString() !== selectedEmployeeFilter) {
          return false;
        }
        // Only show approved
        if (req.status !== 'approved') return false;

        return req.dailyAmounts[dateStr] > 0;
      })
      .map((req) => {
        const emp = employeesList.find((e) => e.id === req.employeeId);
        const type = leaveTypesList.find((t) => t.key === req.leaveType);
        return {
          employeeName: emp ? emp.name : 'Unknown',
          leaveLabel: type ? type.label : '',
          color: type ? type.color : '#3B82F6',
        };
      });
  }

  function handlePrevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function handleNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* ── Header Toolbar ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} />
          Home
        </button>

        <div className="flex items-center gap-4 justify-center">
          <button onClick={handlePrevMonth} className="p-1.5 rounded-lg hover:bg-slate-100">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-slate-800">
            {currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={handleNextMonth} className="p-1.5 rounded-lg hover:bg-slate-100">
            <ChevronRight size={20} />
          </button>
        </div>

        <select
          value={selectedEmployeeFilter}
          onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Employees</option>
          {employeesList.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
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
        <div className="grid grid-cols-7 grid-rows-5 auto-rows-fr divide-x divide-y divide-slate-100">
          {dayCells.map((cell, idx) => {
            const absences = getAbsencesForDate(cell.dateString);
            return (
              <div
                key={idx}
                className={`min-h-[100px] p-2 flex flex-col gap-1 transition-all ${
                  cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50 text-slate-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-bold ${cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-300'}`}>
                    {cell.dayNumber}
                  </span>
                </div>

                {/* Absence list */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-1">
                  {absences.map((abs, aIdx) => (
                    <div
                      key={aIdx}
                      className="px-2 py-1 rounded text-[10px] font-bold text-white truncate shadow-sm"
                      style={{ backgroundColor: abs.color }}
                      title={`${abs.employeeName} (${abs.leaveLabel})`}
                    >
                      {abs.employeeName}
                    </div>
                  ))}
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
          {leaveTypesList.map((type) => (
            <div key={type.key} className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border border-white shadow-sm flex-shrink-0" style={{ backgroundColor: type.color }} />
              <span className="text-xs font-medium text-slate-600">{type.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
