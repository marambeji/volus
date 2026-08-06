import { useState, useEffect } from 'react';
import { X, CalendarDays, FileText, Clock, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, Upload } from 'lucide-react';
import { getMyLeaveBalances, submitLeaveRequest, getMyLeaveRequests } from '../../services/employeesApi';
import { getLeaveTypes } from '../../services/leaveTypesApi';
import { getHolidays } from '../../services/holidaysApi';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DailyAmounts {
  [dateStr: string]: number;
}

export default function RequestModal({ isOpen, onClose }: RequestModalProps) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [typeId, setTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [dailyAmounts, setDailyAmounts] = useState<DailyAmounts>({});
  const [submitted, setSubmitted] = useState(false);

  // Calendar shown month/year state
  const [calDate, setCalDate] = useState(new Date());

  // Public holidays states
  const [holidays, setHolidays] = useState<any[]>([]);
  const [selectedHolidayIds, setSelectedHolidayIds] = useState<string[]>([]);

  // Fetch holidays for the current employee's country
  useEffect(() => {
    if (config?.countryId) {
      getHolidays(config.countryId)
        .then((data) => {
          setHolidays(data);
        })
        .catch(() => {});
    } else {
      setHolidays([]);
      setSelectedHolidayIds([]);
    }
  }, [config?.countryId]);

  const [myRequests, setMyRequests] = useState<any[]>([]);

  // Fetch Configuration & Leave Types & My Requests
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setErrorMsg('');
      const fetchConfig = async () => {
        try {
          const [conf, allLeaveTypes, existingRequests] = await Promise.all([
            getMyLeaveBalances().catch(() => ({ balances: [] })),
            getLeaveTypes().catch(() => []),
            getMyLeaveRequests().catch(() => []),
          ]);

          setMyRequests(existingRequests || []);

          const existingBalances = conf?.balances || [];
          const balanceTypeIds = new Set(existingBalances.map((b: any) => b.leaveTypeId));

          // Merge leave types that might not have active policy rules/balances calculated yet
          const combinedBalances = [...existingBalances];
          for (const lt of allLeaveTypes) {
            if (!balanceTypeIds.has(lt.id)) {
              combinedBalances.push({
                leaveTypeId: lt.id,
                code: lt.key.toUpperCase(),
                name: lt.label,
                availableBalance: 0,
                usageYtd: 0,
                trackingMode: lt.trackingMode,
                allowsHalfDay: true,
                requiresNote: false,
                requiresDocument: false,
                requiresPositiveBalance: false,
                eligible: true,
              });
            }
          }

          const finalConfig = { ...(conf || {}), balances: combinedBalances };
          setConfig(finalConfig);

          if (combinedBalances.length > 0) {
            const defaultType = combinedBalances.find((t: any) => t.code?.toUpperCase() === 'ANNUAL') || combinedBalances[0];
            setTypeId(defaultType.leaveTypeId);
          }
        } catch (error: any) {
          setErrorMsg(error.message || 'Failed to load leave balances.');
        } finally {
          setLoading(false);
        }
      };
      fetchConfig();
    } else {
      setStartDate('');
      setEndDate('');
      setReason('');
      setSubmitted(false);
      setCalDate(new Date());
      setConfig(null);
      setSelectedHolidayIds([]);
    }
  }, [isOpen]);

  // Sync calendar view with start date if selected
  useEffect(() => {
    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) {
        setCalDate(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  }, [startDate]);

  const selectedLeaveConfig = config?.balances?.find((t: any) => t.leaveTypeId === typeId);
  const allowsHalfDay = selectedLeaveConfig?.allowsHalfDay ?? false;
  const trackingMode = selectedLeaveConfig?.trackingMode;
  const availableBalance = selectedLeaveConfig?.availableBalance ?? 0;
  const usageYtd = selectedLeaveConfig?.usageYtd ?? 0;
  const requiresNote = selectedLeaveConfig?.requiresNote ?? false;
  const requiresDocument = selectedLeaveConfig?.requiresDocument ?? false;
  const requiresPositiveBalance = selectedLeaveConfig?.requiresPositiveBalance ?? true;
  const minRequestDays = selectedLeaveConfig?.minRequestDays ?? 0;
  const maxRequestDays = selectedLeaveConfig?.maxRequestDays;
  const maxConsecutiveDays = selectedLeaveConfig?.maxConsecutiveDays;

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

  // Real balances return a lowercase code (e.g. "public_holiday"); only the
  // synthetic fallback entry above (for a leave type with no balance yet)
  // uppercases it — compare case-insensitively so this works for both.
  const isPublicHolidayType = selectedLeaveConfig?.code?.toUpperCase() === 'PUBLIC_HOLIDAY';
  const totalDays = isPublicHolidayType
    ? selectedHolidayIds.length
    : Object.values(dailyAmounts).reduce((sum, val) => sum + val, 0);

  // Helper to check proactive date overlap against active existing requests
  const activeRequests = myRequests.filter(
    (r: any) => r.status === 'PENDING' || r.status === 'APPROVED'
  );

  const getConflictingRequest = (start: string, end: string) => {
    if (!start || !end) return null;
    return activeRequests.find(
      (r: any) => r.startDate <= end && r.endDate >= start
    );
  };

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Sorted public holidays (closest date first)
  const sortedHolidays = [...holidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Hard errors (block submission)
  let blockingError = '';
  // Soft warning (overdraft allowed)
  let overdraftWarning = '';
  if (selectedLeaveConfig) {
    if (selectedLeaveConfig.eligible === false) {
      blockingError = selectedLeaveConfig.ineligibilityReasons.join(' ');
    } else if (isPublicHolidayType) {
      if (selectedHolidayIds.length === 0) {
        blockingError = 'Please select at least one public holiday.';
      } else {
        // Check if any selected holiday conflicts with existing active requests
        for (const holidayId of selectedHolidayIds) {
          const holiday = holidays.find((h) => h.id === holidayId);
          if (holiday) {
            const conflict = getConflictingRequest(holiday.date, holiday.date);
            if (conflict) {
              const fromStr = new Date(conflict.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              const toStr = new Date(conflict.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              const statusStr = (conflict.status || 'existing').toLowerCase();
              blockingError = `Selected holiday (${holiday.name}) overlaps with an existing ${statusStr} request from ${fromStr} to ${toStr}.`;
              break;
            }
          }
        }
      }
      if (!blockingError) {
        if (requiresNote && !reason.trim()) {
          blockingError = `A note is required for this leave type.`;
        } else if (requiresDocument) {
          blockingError = `A supporting document is required for this leave type (Secure attachment service is missing).`;
        }
      }
    } else {
      if (startDate && startDate < todayStr) {
        blockingError = 'Start date cannot be in the past.';
      } else if (endDate && endDate < todayStr) {
        blockingError = 'End date cannot be in the past.';
      } else if (startDate && endDate && endDate < startDate) {
        blockingError = 'End date cannot be before start date.';
      } else if (startDate && endDate) {
        const conflict = getConflictingRequest(startDate, endDate);
        if (conflict) {
          const fromStr = new Date(conflict.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          const toStr = new Date(conflict.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          const statusStr = (conflict.status || 'existing').toLowerCase();
          blockingError = `You already have an ${statusStr} leave request from ${fromStr} to ${toStr}.`;
        } else if (minRequestDays > 0 && totalDays < minRequestDays) {
          blockingError = `Request must be at least ${minRequestDays} day(s).`;
        } else if (maxRequestDays !== null && maxRequestDays !== undefined && totalDays > maxRequestDays) {
          blockingError = `Request cannot exceed ${maxRequestDays} day(s).`;
        } else if (maxConsecutiveDays !== null && maxConsecutiveDays !== undefined && totalDays > maxConsecutiveDays) {
          blockingError = `Request cannot exceed ${maxConsecutiveDays} consecutive chargeable day(s).`;
        } else if (trackingMode === 'AVAILABLE_BALANCE' && (availableBalance - totalDays) < 0) {
          // Overdraft is allowed — warn but do not block
          const deficit = Math.abs(availableBalance - totalDays);
          overdraftWarning = `Your balance will go negative by ${deficit} day(s). The request will be submitted but your balance will be −${Math.abs(availableBalance - totalDays)}d.`;
        }
      }
      if (!blockingError) {
        if (requiresNote && !reason.trim()) {
          blockingError = `A note is required for this leave type.`;
        } else if (requiresDocument) {
          blockingError = `A supporting document is required for this leave type (Secure attachment service is missing).`;
        }
      }
    }
  }
  // Keep legacy alias for any remaining references
  const validationError = blockingError;

  // Mini calendar cells generation
  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const calTotalDays = new Date(calYear, calMonth + 1, 0).getDate();
  const calStartDayIndex = new Date(calYear, calMonth, 1).getDay();

  const calCells = [];
  const prevMonthTotalDays = new Date(calYear, calMonth, 0).getDate();
  
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
  
  for (let i = 1; i <= calTotalDays; i++) {
    calCells.push({
      dayNumber: i,
      isCurrentMonth: true,
      dateString: `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    });
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (blockingError) return;
    
    setLoading(true);
    try {
      if (isPublicHolidayType) {
        // Loop and submit a single day leave request for each selected holiday
        for (const holidayId of selectedHolidayIds) {
          const holiday = holidays.find(h => h.id === holidayId);
          if (!holiday) continue;
          await submitLeaveRequest({
            leaveTypeId: typeId,
            startDate: holiday.date,
            endDate: holiday.date,
            durationDays: 1,
            reason: `Public Holiday: ${holiday.name}` + (reason ? ` - ${reason}` : ''),
          });
        }
      } else {
        await submitLeaveRequest({
          leaveTypeId: typeId,
          startDate,
          endDate,
          durationDays: totalDays,
          reason,
        });
      }
      setSubmitted(true);
      window.dispatchEvent(new Event('leave-request-submitted'));
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      const details = err?.details || err?.response || {};
      const conflicting = details.conflictingRequest;
      if (conflicting && conflicting.fromDate && conflicting.toDate) {
        const fromStr = new Date(conflicting.fromDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const toStr = new Date(conflicting.toDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const statusStr = (conflicting.status || 'existing').toLowerCase();
        alert(`You already have an ${statusStr} leave request from ${fromStr} to ${toStr}.`);
      } else {
        alert(err?.message || 'You already have a leave request for this day or period.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDailyAmountChange(dateStr: string, value: number) {
    setDailyAmounts((prev) => ({
      ...prev,
      [dateStr]: value,
    }));
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-3xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
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

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 p-8">
            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-start gap-2">
              <AlertCircle size={20} className="mt-0.5" />
              <p>{errorMsg}</p>
            </div>
          </div>
        ) : submitted ? (
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-center bg-slate-50">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Request Submitted Successfully!</h3>
            <p className="text-slate-500 text-sm max-w-sm mb-6">
              Your request for {totalDays} {totalDays === 1 ? 'day' : 'days'} of {selectedLeaveConfig?.name} has been sent to your manager for approval.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
                
                <div className="lg:col-span-5 flex flex-col gap-6 lg:border-r lg:border-slate-100 lg:pr-6">
                  
                  <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-3">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {trackingMode === 'USAGE_YTD' ? 'Usage YTD' : 'Leave Balance'}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-3xl font-black text-slate-800">
                          {trackingMode === 'USAGE_YTD' ? usageYtd : availableBalance}
                        </span>
                        <span className="text-xs text-slate-500 font-medium ml-1">
                          {trackingMode === 'USAGE_YTD' ? 'days used' : 'days available'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-200/80 px-2.5 py-1 rounded-full uppercase tracking-wider truncate max-w-[120px]">
                        {selectedLeaveConfig?.name}
                      </span>
                    </div>

                    {totalDays > 0 && trackingMode === 'AVAILABLE_BALANCE' && (
                      <div className="border-t border-slate-200/60 pt-3 flex flex-col gap-2 text-xs">
                        <div className="flex justify-between text-slate-500">
                          <span>Requested days:</span>
                          <span className="font-semibold text-red-500">-{totalDays} days</span>
                        </div>
                        <div className="flex justify-between text-slate-800 font-bold border-t border-dashed border-slate-200 pt-2">
                          <span>Remaining balance:</span>
                          <span className={availableBalance - totalDays < 0 ? "text-red-600" : "text-emerald-600"}>
                            {(availableBalance - totalDays).toFixed(1)} days
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

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
                      <div className="grid grid-cols-7 text-center border-b border-slate-200/40 pb-1.5 mb-0.5">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                          <span key={idx} className="text-[9px] font-bold text-slate-400">{d}</span>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center">
                        {calCells.map((cell, idx) => {
                          const isSelected = startDate && endDate && cell.isCurrentMonth && cell.dateString >= startDate && cell.dateString <= endDate;
                          const isPast = cell.isCurrentMonth && cell.dateString < todayStr;
                          let cellClass = "relative h-7 w-7 text-xs flex items-center justify-center rounded-lg font-bold transition-all ";
                          if (!cell.isCurrentMonth) {
                            cellClass += "text-slate-300 bg-transparent pointer-events-none ";
                          } else if (isPast) {
                            cellClass += "text-slate-400 bg-transparent opacity-40 cursor-not-allowed pointer-events-none ";
                          } else if (isSelected) {
                            cellClass += "bg-[#1b2559] text-white shadow-md shadow-blue-900/20";
                          } else {
                            cellClass += "text-slate-700 hover:bg-slate-200";
                          }

                          return (
                            <div key={idx} className="flex justify-center">
                              <div className={cellClass}>
                                {cell.dayNumber}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 flex flex-col gap-6">
                  
                  {blockingError && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 flex items-start gap-2 text-sm">
                      <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                      <p>{blockingError}</p>
                    </div>
                  )}

                  {overdraftWarning && !blockingError && (
                    <div className="bg-amber-50 text-amber-700 p-3 rounded-xl border border-amber-200 flex items-start gap-2 text-sm">
                      <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
                      <p>{overdraftWarning}</p>
                    </div>
                  )}

                  {/* Form fields */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Leave Type *</label>
                    <div className="relative">
                      <select
                        value={typeId}
                        onChange={(e) => setTypeId(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/60 rounded-xl text-sm font-medium text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        required
                      >
                        <option value="" disabled>Select Leave Type</option>
                        {config?.balances?.map((lt: any) => (
                          <option key={lt.leaveTypeId} value={lt.leaveTypeId} disabled={lt.eligible === false}>
                            {lt.name} {lt.eligible === false ? '(Ineligible)' : ''}
                          </option>
                        ))}
                      </select>
                      <FileText size={16} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                  </div>

                  {isPublicHolidayType ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                          Select Public Holidays *
                        </label>
                        {sortedHolidays.length > 0 && (
                          <div className="flex items-center gap-2 text-[10px] font-semibold">
                            <button
                              type="button"
                              onClick={() => setSelectedHolidayIds(sortedHolidays.map((h) => h.id))}
                              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                            >
                              Select all
                            </button>
                            <span className="text-slate-300">·</span>
                            <button
                              type="button"
                              onClick={() => setSelectedHolidayIds([])}
                              className="text-slate-400 hover:text-slate-600 hover:underline transition-colors cursor-pointer"
                            >
                              Clear
                            </button>
                            {selectedHolidayIds.length > 0 && (
                              <span className="ml-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                {selectedHolidayIds.length} selected
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {sortedHolidays.length === 0 ? (
                        <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-center text-sm text-slate-400">
                          No public holidays found for your country.
                        </div>
                      ) : (
                        <div className="relative">
                          {/* Scrollable list panel */}
                          <div
                            className="flex flex-col gap-2 border border-slate-200/80 rounded-xl bg-slate-50/50 overflow-hidden"
                            style={{ maxHeight: '260px' }}
                          >
                            <div
                              className="flex flex-col gap-0 overflow-y-auto"
                              style={{
                                maxHeight: '260px',
                                scrollbarWidth: 'thin',
                                scrollbarColor: '#CBD5E1 transparent',
                              }}
                            >
                              {sortedHolidays.map((holiday, idx) => {
                                const isChecked = selectedHolidayIds.includes(holiday.id);
                                const isLast = idx === sortedHolidays.length - 1;
                                const hDate = new Date(holiday.date);
                                const isThisMonth = hDate.getMonth() === calMonth && hDate.getFullYear() === calYear;
                                return (
                                  <label
                                    key={holiday.id}
                                    className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none transition-colors ${
                                      !isLast ? 'border-b border-slate-200/60' : ''
                                    } ${
                                      isChecked
                                        ? 'bg-blue-50 hover:bg-blue-50/80'
                                        : 'hover:bg-white'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedHolidayIds((prev) =>
                                            prev.includes(holiday.id)
                                              ? prev.filter((id) => id !== holiday.id)
                                              : [...prev, holiday.id]
                                          );
                                        }}
                                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                      />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className={`text-sm font-semibold truncate ${isChecked ? 'text-blue-900' : 'text-slate-800'}`}>
                                            {holiday.name}
                                          </p>
                                          {isThisMonth && (
                                            <span className="flex-shrink-0 text-[9px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                                              This Month
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                          {new Date(holiday.date).toLocaleDateString('en-GB', {
                                            weekday: 'short',
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                          })}
                                        </p>
                                      </div>
                                    </div>
                                    {holiday.recurring && (
                                      <span className="ml-2 flex-shrink-0 text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        Yearly
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                          {/* Gradient fade at bottom to indicate more content */}
                          {sortedHolidays.length > 4 && (
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-50/90 to-transparent pointer-events-none rounded-b-xl" />
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{sortedHolidays.length} holiday{sortedHolidays.length !== 1 ? 's' : ''} available</span>
                        <span className="font-semibold text-slate-700">
                          Total Chargeable Days: <span className="text-[#1b2559] text-base font-black ml-1">{totalDays}</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">From Date *</label>
                          <div className="relative">
                            <input
                              type="date"
                              value={startDate}
                              min={todayStr}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/60 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                              required
                            />
                            <CalendarDays size={16} className="absolute left-3 top-3 text-slate-400" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">To Date *</label>
                          <div className="relative">
                            <input
                              type="date"
                              value={endDate}
                              min={startDate || todayStr}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/60 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                              required
                            />
                            <CalendarDays size={16} className="absolute left-3 top-3 text-slate-400" />
                          </div>
                        </div>
                      </div>

                      {Object.keys(dailyAmounts).length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Duration Adjustments</label>
                          <div className="bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                            <table className="w-full text-sm text-left text-slate-600">
                              <thead className="text-[10px] text-slate-400 uppercase bg-slate-100/50 sticky top-0 z-10">
                                <tr>
                                  <th className="px-4 py-2 font-bold">Date</th>
                                  <th className="px-4 py-2 font-bold text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200/50">
                                {Object.entries(dailyAmounts).map(([date, amount]) => {
                                  const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
                                  return (
                                    <tr key={date} className={isWeekend ? 'bg-slate-100/30 text-slate-400' : ''}>
                                      <td className="px-4 py-2 font-medium">
                                        {new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                                        {isWeekend && <span className="ml-2 text-[9px] uppercase tracking-wider bg-slate-200 px-1.5 py-0.5 rounded">Weekend</span>}
                                      </td>
                                      <td className="px-4 py-2 text-right">
                                        <select
                                          value={amount}
                                          onChange={(e) => handleDailyAmountChange(date, Number(e.target.value))}
                                          className="text-right bg-transparent outline-none cursor-pointer hover:bg-slate-200 px-2 py-1 rounded"
                                        >
                                          <option value={0}>0 (Exclude)</option>
                                          {allowsHalfDay && <option value={0.5}>0.5 (Half Day)</option>}
                                          <option value={1}>1 (Full Day)</option>
                                        </select>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="mt-2 text-right text-xs font-semibold text-slate-600">
                            Total Chargeable Days: <span className="text-[#1b2559] text-base">{totalDays}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Note {requiresNote ? '*' : '(Optional)'}
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      placeholder={requiresNote ? 'Please provide a reason...' : 'Add any comments...'}
                      required={requiresNote}
                    />
                  </div>

                  {requiresDocument && (
                    <div>
                       <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Supporting Document *</label>
                       <div className="w-full flex flex-col items-center justify-center p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-sm text-slate-500">
                         <Upload size={20} className="mb-2 text-slate-400" />
                         <span>Upload feature unavailable. Secure attachment service is missing.</span>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200/60 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!!validationError || totalDays === 0}
                className="px-6 py-2 bg-[#1b2559] hover:bg-[#111c44] text-white text-sm font-bold rounded-lg shadow-md shadow-[#1b2559]/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
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
