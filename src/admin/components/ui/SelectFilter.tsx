interface Option { label: string; value: string }
interface SelectFilterProps { label: string; value: string; onChange: (v: string) => void; options: Option[] }

export function SelectFilter({ label, value, onChange, options }: SelectFilterProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-2.5 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
      aria-label={label}
    >
      <option value="">{label}: All</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
