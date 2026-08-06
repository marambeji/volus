import SearchInput from '../../admin/components/ui/SearchInput';
import { SelectFilter } from '../../admin/components/ui/SelectFilter';

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

// Reusable filter row for the Reports pages — which controls render depends
// on which handlers are passed, so the same component covers Admin/Manager
// Requests & Balances tabs (full filter set) and Employee's personal tab
// (just leave type + date range) without a big role-switch inside it.
export default function ReportFilterBar(props: ReportFilterBarProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-wrap gap-3 items-center">
      {props.onSearchChange && (
        <div className="flex-1 min-w-48">
          <SearchInput
            value={props.search ?? ''}
            onChange={props.onSearchChange}
            placeholder={props.searchPlaceholder ?? 'Search...'}
          />
        </div>
      )}

      {(props.onDateFromChange || props.onDateToChange) && (
        <div className="flex items-center gap-2">
          {props.onDateFromChange && (
            <>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</label>
              <input
                type="date"
                value={props.dateFrom ?? ''}
                onChange={(e) => props.onDateFromChange!(e.target.value)}
                className="px-3 py-2.5 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
              />
            </>
          )}
          {props.onDateToChange && (
            <>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</label>
              <input
                type="date"
                value={props.dateTo ?? ''}
                onChange={(e) => props.onDateToChange!(e.target.value)}
                className="px-3 py-2.5 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
              />
            </>
          )}
        </div>
      )}

      {props.onLeaveTypeChange && (
        <SelectFilter
          label="Leave Type"
          value={props.leaveTypeId ?? ''}
          onChange={props.onLeaveTypeChange}
          options={props.leaveTypeOptions ?? []}
        />
      )}
      {props.onDepartmentChange && (
        <SelectFilter
          label="Department"
          value={props.department ?? ''}
          onChange={props.onDepartmentChange}
          options={props.departmentOptions ?? []}
        />
      )}
      {props.onCountryChange && (
        <SelectFilter
          label="Country"
          value={props.country ?? ''}
          onChange={props.onCountryChange}
          options={props.countryOptions ?? []}
        />
      )}
      {props.onManagerChange && (
        <SelectFilter
          label="Manager"
          value={props.managerId ?? ''}
          onChange={props.onManagerChange}
          options={props.managerOptions ?? []}
        />
      )}
      {props.onStatusChange && (
        <SelectFilter
          label="Status"
          value={props.status ?? ''}
          onChange={props.onStatusChange}
          options={props.statusOptions ?? []}
        />
      )}
    </div>
  );
}
