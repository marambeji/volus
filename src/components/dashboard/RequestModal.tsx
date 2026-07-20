import { useState, useEffect } from 'react';
import { X, CalendarDays, FileText, Clock, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, Info } from 'lucide-react';
import { leaveTypesList, leaveBalancesList, leaveLedgerList, upcomingHolidays } from '../../data/mockData';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DailyAmounts {
  [dateStr: string]: number;
}

export default function RequestModal({ isOpen, onClose }: RequestModalProps) {
  const [type, setType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [dailyAmounts, setDailyAmounts] = useState<DailyAmounts>({});
  const [submitted, setSubmitted] = useState(false);

  // Calendar shown month/year state
  const [calDate, setCalDate] = useState(new Date(2026, 6, 8)); // default to July 2026

  // Sync calendar view with start date if selected
  useEffect(() => {
    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) {
        setCalDate(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  }, [startDate]);

  // Reset form when drawer is closed
  useEffect(() => {
    if (!isOpen) {
      setStartDate('');
      setEndDate('');
      setReason('');
      setType('annual');
      setSubmitted(false);
      setCalDate(new Date(2026, 6, 8));
    }
  }, [isOpen]);

  // Helper to generate dates between start and end
  useEffect(() => {
    if (!startDate || !endDate) {
      setDailyAmounts({});
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      setDailyAmounts({});
      return;
    }

    const tempDaily: DailyAmounts = {};
    let current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
      // Default weekend days to 0, week days to 1
      tempDaily[dateStr] = (dayOfWeek === 0 || dayOfWeek === 6) ? 0 : 1;
      current.setDate(current.getDate() + 1);
    }
    setDailyAmounts(tempDaily);
  }, [startDate, endDate]);

  // Retrieve balance for selected leave type for Gabriel Habre (ID 1)
  const currentBalance = leaveBalancesList.find(
    (b) => b.employeeId === 1 && b.leaveType === type
  )?.amount ?? 0;

  // Retrieve leave history ledger for selected leave type for Gabriel
  const filteredLedger = leaveLedgerList
    .filter((entry) => entry.employeeId === 1 && entry.leaveType === type)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Past leave dates for visual mini calendar tracking (Gabriel's June leave)
  const pastLeaveDates = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-05-12'];

  // Mini calendar cells generation
  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const calTotalDays = new Date(calYear, calMonth + 1, 0).getDate();
  const calStartDayIndex = new Date(calYear, calMonth, 1).getDay();

  const calCells = [];
  const prevMonthTotalDays = new Date(calYear, calMonth, 0).getDate();
  
  // Previous month padding
  for (let i = calStartDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const m = calMonth === 0 ? 11 : calMonth - 1;
    const y = calMonth === 0 ? calYear - 1 : calYear;
    calCells.push({
      dayNumber: dayNum,
      isCurrentMonth: false,
      dateString: `${y}-${String(m + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    });
  }
  
  // Current month
  for (let i = 1; i <= calTotalDays; i++) {
    calCells.push({
      dayNumber: i,
      isCurrentMonth: true,
      dateString: `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    });
  }

  // Next month padding to fill grid (either 35 or 42 cells)
  const totalCellsSoFar = calCells.length;
  const remainingCells = (totalCellsSoFar <= 35 ? 35 : 42) - totalCellsSoFar;
  for (let i = 1; i <= remainingCells; i++) {
    const m = calMonth === 11 ? 0 : calMonth + 1;
    const y = calMonth === 11 ? calYear + 1 : calYear;
    calCells.push({
      dayNumber: i,
      isCurrentMonth: false,
      dateString: `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    });
  }

  function handlePrevMonth() {
    setCalDate(new Date(calYear, calMonth - 1, 1));
  }

  function handleNextMonth() {
    setCalDate(new Date(calYear, calMonth + 1, 1));
  }

  // Calculate sum of days
  const totalDays = Object.values(dailyAmounts).reduce((sum, val) => sum + val, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      setType('annual');
      onClose();
    }, 2000);
  }

  function handleDailyAmountChange(dateStr: string, value: number) {
    setDailyAmounts((prev) => ({
      ...prev,
      [dateStr]: value,
    }));
  }

  const selectedTypeLabel = leaveTypesList.find((t) => t.key === type)?.label ?? 'Leave';

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sliding Panel (Drawer) */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-3xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e306e]/10 bg-gradient-to-r from-[#1b2559] to-[#111c44] text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={20} className="animate-pulse" />
            <div>
              <h2 className="font-bold text-lg">Request Time Off</h2>
              <p className="text-xs text-blue-100">Fill in details and review your balances</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-100 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-center bg-slate-50">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Request Submitted Successfully!</h3>
            <p className="text-slate-500 text-sm max-w-sm mb-6">
              Your request for {totalDays} {totalDays === 1 ? 'day' : 'days'} of {selectedTypeLabel} has been sent to your manager for approval.
            </p>
            <div className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              Status: Pending Review
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            {/* Scrollable Layout */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
                
                {/* ── LEFT COLUMN: Info, Balance & History (col-span-5) ── */}
                <div className="lg:col-span-5 flex flex-col gap-6 lg:border-r lg:border-slate-100 lg:pr-6">
                  
                  {/* Balance Status Widget */}
                  <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-3">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leave Balance</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-3xl font-black text-slate-800">{currentBalance}</span>
                        <span className="text-xs text-slate-500 font-medium ml-1">days available</span>
                      </div>
                      <span 
                        className="text-[10px] font-bold text-slate-700 bg-slate-200/80 px-2.5 py-1 rounded-full uppercase tracking-wider truncate max-w-[120px]"
                        title={selectedTypeLabel}
                      >
                        {selectedTypeLabel}
                      </span>
                    </div>

                    {/* Projected balance calculation */}
                    {totalDays > 0 && (
                      <div className="border-t border-slate-200/60 pt-3 flex flex-col gap-2 text-xs">
                        <div className="flex justify-between text-slate-500">
                          <span>Requested days:</span>
                          <span className="font-semibold text-red-500">-{totalDays} days</span>
                        </div>
                        <div className="flex justify-between text-slate-800 font-bold border-t border-dashed border-slate-200 pt-2">
                          <span>Remaining balance:</span>
                          <span className={currentBalance - totalDays < 0 ? "text-red-600" : "text-emerald-600"}>
                            {(currentBalance - totalDays).toFixed(1)} days
                          </span>
                        </div>

                        {currentBalance - totalDays < 0 && (
                          <div className="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded-xl p-2.5 flex items-start gap-1.5 mt-1 leading-normal">
                            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                            <span>Warning: This request exceeds your available balance for this category.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Interactive Mini Calendar */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leave Calendar</h3>
                      <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-0.5 border border-slate-100">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="p-1 rounded hover:bg-white hover:shadow-xs text-slate-500 transition-colors"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span className="text-[10px] font-bold text-slate-700 px-1 text-center min-w-[70px]">
                          {calDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="p-1 rounded hover:bg-white hover:shadow-xs text-slate-500 transition-colors"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3.5 flex flex-col gap-2">
                      {/* Weekday headers */}
                      <div className="grid grid-cols-7 text-center border-b border-slate-200/40 pb-1.5 mb-0.5">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                          <span key={idx} className="text-[9px] font-bold text-slate-400">{d}</span>
                        ))}
                      </div>

                      {/* Day cells grid */}
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {calCells.map((cell, idx) => {
                          const isSelected = startDate && endDate && cell.isCurrentMonth && cell.dateString >= startDate && cell.dateString <= endDate;
                          const holiday = upcomingHolidays.find(h => h.date === cell.dateString);
                          const isPast = pastLeaveDates.includes(cell.dateString);

                          let cellClass = "relative h-7 w-7 text-xs flex items-center justify-center rounded-lg font-bold transition-all ";
                          if (!cell.isCurrentMonth) {
                            cellClass += "text-slate-300 bg-transparent pointer-events-none ";
                          } else if (isSelected) {
                            cellClass += "bg-[#20347C] text-white shadow-sm scale-105 z-10 ";
                          } else if (holiday) {
                            cellClass += "bg-emerald-50 text-emerald-700 border border-emerald-200/60 ";
                          } else if (isPast) {
                            cellClass += "bg-amber-50 text-amber-800 border border-amber-200/60 ";
                          } else {
                            cellClass += "text-slate-700 hover:bg-slate-200/50 cursor-pointer ";
                          }

                          return (
                            <div
                              key={idx}
                              className={cellClass}
                              title={
                                holiday ? `Holiday: ${holiday.name}` :
                                isPast ? "Past Leave Day" :
                                isSelected ? "Selected range" : ""
                              }
                            >
                              <span>{cell.dayNumber}</span>
                              {/* Bottom indicators */}
                              {!isSelected && (
                                <div className="absolute bottom-0.5 flex gap-0.5 justify-center">
                                  {holiday && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                                  {isPast && <span className="w-1 h-1 rounded-full bg-amber-500" />}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Legend */}
                      <div className="border-t border-slate-200/60 pt-2 mt-1 flex flex-wrap gap-x-2.5 gap-y-1 justify-center text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-[#20347C]" />
                          <span>Selected</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-amber-50 border border-amber-200/60" />
                          <span>Past Leaves</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-emerald-50 border border-emerald-200/60" />
                          <span>Holidays</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* History Ledger List */}
                  <div className="flex flex-col gap-2.5">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type History</h3>
                    <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1">
                      {filteredLedger.length === 0 ? (
                        <div className="text-[10px] text-slate-400 bg-slate-50 rounded-xl p-3 border border-dashed border-slate-200 text-center font-medium">
                          No transaction history for this type.
                        </div>
                      ) : (
                        filteredLedger.map((entry) => (
                          <div key={entry.id} className="bg-white border border-slate-100 p-2.5 rounded-xl shadow-xs flex flex-col gap-0.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-slate-700 truncate max-w-[150px]">{entry.description}</span>
                              <span className={`font-black text-[11px] ${entry.change < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {entry.change > 0 ? `+${entry.change}` : entry.change} days
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-slate-400 font-medium">
                              <span>{new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              <span>Bal: {entry.balance} days</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                {/* ── RIGHT COLUMN: Request Details Form (col-span-7) ── */}
                <div className="lg:col-span-7 flex flex-col gap-5">
                  
                  {/* Select Leave Type */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Leave Type
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      {leaveTypesList.map((t) => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Dates Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        <span className="flex items-center gap-1"><CalendarDays size={12} /> Start Date</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        <span className="flex items-center gap-1"><CalendarDays size={12} /> End Date</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Day breakdown and customizations */}
                  {Object.keys(dailyAmounts).length > 0 && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Day Breakdown
                        </h4>
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                          Calculated: {totalDays} {totalDays === 1 ? 'day' : 'days'}
                        </span>
                      </div>

                      <p className="text-[9px] text-slate-400 font-medium flex items-center gap-1 leading-none mb-1">
                        <Info size={12} /> Note: Weekends are set to 0.0 days. Customize fractions for half days.
                      </p>

                      <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1">
                        {Object.entries(dailyAmounts).map(([dateStr, val]) => {
                          const dateObj = new Date(dateStr);
                          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                          const formattedDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                          
                          return (
                            <div 
                              key={dateStr} 
                              className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-xl shadow-xs"
                            >
                              <span className="text-xs font-semibold text-slate-600">
                                {dayName}, {formattedDate}
                              </span>
                              <select
                                value={val}
                                onChange={(e) => handleDailyAmountChange(dateStr, Number(e.target.value))}
                                className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-bold focus:outline-none"
                              >
                                <option value={1}>1.0 Day (Full)</option>
                                <option value={0.5}>0.5 Day (Half)</option>
                                <option value={0}>0.0 Day (Off)</option>
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Reason Textarea */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      <span className="flex items-center gap-1"><FileText size={12} /> Reason (optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Explain your absence to your manager..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                </div>

              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex gap-3 p-6 border-t border-slate-100 bg-slate-50 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 active:scale-98 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={totalDays === 0}
                className="flex-1 px-4 py-3 text-sm font-black text-white bg-[#96C13C] hover:bg-[#83aa32] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed active:scale-98 rounded-xl shadow-sm hover:shadow transition-all"
              >
                Submit Request
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
