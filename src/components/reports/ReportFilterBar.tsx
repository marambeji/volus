import { Calendar, Filter, XCircle } from 'lucide-react';
import SearchInput from '../../admin/components/ui/SearchInput';

interface Option {
  label: string;
  value: string;
}

interface ReportFilterBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;

  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (v: string) => void;
  onDateToChange?: (v: string) => void;

  leaveTypeOptions?: Option[];
  leaveTypeId?: string;
  onLeaveTypeChange?: (v: string) => void;

  departmentOptions?: Option[];
  department?: string;
  onDepartmentChange?: (v: string) => void;

  countryOptions?: Option[];
  country?: string;
  onCountryChange?: (v: string) => void;

  managerOptions?: Option[];
  managerId?: string;
  onManagerChange?: (v: string) => void;

  statusOptions?: Option[];
  status?: string;
  onStatusChange?: (v: string) => void;
}

export default function ReportFilterBar(props: ReportFilterBarProps) {
  const hasActiveFilters = Boolean(
    (props.search && props.search.trim()) ||
      props.dateFrom ||
      props.dateTo ||
      props.leaveTypeId ||
      props.department ||
      props.country ||
      props.managerId ||
      props.status
  );

  const handleClear = () => {
    props.onSearchChange?.('');
    props.onDateFromChange?.('');
    props.onDateToChange?.('');
    props.onLeaveTypeChange?.('');
    props.onDepartmentChange?.('');
    props.onCountryChange?.('');
    props.onManagerChange?.('');
    props.onStatusChange?.('');
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-slate-100 dark:border-slate-700/80 shadow-sm flex flex-wrap gap-3 items-center">
      {/* Search Input */}
      {props.onSearchChange && (
        <div className="flex-1 min-w-52">
          <SearchInput
            value={props.search ?? ''}
            onChange={props.onSearchChange}
            placeholder={props.searchPlaceholder ?? 'Search team member...'}
          />
        </div>
      )}

      {/* Date From */}
      {props.onDateFromChange && (
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-3.5 py-2 shadow-xs">
          <Calendar size={14} className="text-slate-400 shrink-0" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</span>
          <input
            type="date"
            value={props.dateFrom ?? ''}
            onChange={(e) => props.onDateFromChange!(e.target.value)}
            className="text-sm bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none font-medium"
          />
        </div>
      )}

      {/* Date To */}
      {props.onDateToChange && (
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-3.5 py-2 shadow-xs">
          <Calendar size={14} className="text-slate-400 shrink-0" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</span>
          <input
            type="date"
            value={props.dateTo ?? ''}
            onChange={(e) => props.onDateToChange!(e.target.value)}
            className="text-sm bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none font-medium"
          />
        </div>
      )}

      {/* Leave Type Select */}
      {props.onLeaveTypeChange && (
        <div className="relative min-w-44">
          <select
            value={props.leaveTypeId ?? ''}
            onChange={(e) => props.onLeaveTypeChange!(e.target.value)}
            className="w-full pl-3.5 pr-8 py-2.5 text-xs bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 font-bold appearance-none cursor-pointer"
          >
            <option value="">Leave Type: All</option>
            {(props.leaveTypeOptions ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Filter size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      )}

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          onClick={handleClear}
          className="px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition flex items-center gap-1.5 shadow-xs"
        >
          <XCircle size={13} /> Clear
        </button>
      )}
    </div>
  );
}
