import { useEffect, useRef, useState } from 'react';
import { Link2, Search, ExternalLink, ChevronDown } from 'lucide-react';
import { companyLinkCategories } from '../../data/mockData';
import EmptyState from '../ui/EmptyState';

export default function CompanyLinks() {
  const [categoryValue, setCategoryValue] = useState(companyLinkCategories[0].value);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const category = companyLinkCategories.find((c) => c.value === categoryValue) ?? companyLinkCategories[0];

  const filtered = category.searchable
    ? category.links.filter((link) => (link.country ?? link.label).toLowerCase().includes(query.toLowerCase()))
    : category.links;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
          <Link2 size={16} className="text-indigo-600" />
        </div>
        <h2 className="text-slate-800 font-semibold text-base">Company Links</h2>

        <div className="relative ml-auto" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 pl-3 pr-2.5 py-1.5 text-xs font-semibold text-blue-600 bg-white border border-blue-200 rounded-full hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
          >
            <span className="max-w-[150px] truncate">{category.label}</span>
            <ChevronDown size={13} className={`transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-slate-100 shadow-lg py-1 z-20 max-h-72 overflow-y-auto">
              {companyLinkCategories.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setCategoryValue(c.value);
                    setQuery('');
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-sm transition-colors ${
                    c.value === categoryValue
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search input (Public Holidays only) */}
      {category.searchable && (
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search country..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      )}

      {/* Link list */}
      <div
        className={`overflow-y-auto divide-y divide-slate-50 px-2 pb-2 rounded-b-2xl ${category.searchable ? '' : 'pt-2'}`}
        style={{ maxHeight: '340px' }}
      >
        {filtered.length === 0 ? (
          <EmptyState
            title="No results"
            message={`No country found for "${query}".`}
            icon="🌍"
          />
        ) : (
          filtered.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-blue-50 group transition-colors"
            >
              {link.flag ? (
                <span className="text-xl flex-shrink-0">{link.flag}</span>
              ) : link.icon ? (
                <span className={`w-9 h-9 ${link.iconBg ?? 'bg-slate-50'} rounded-lg flex items-center justify-center text-lg flex-shrink-0`}>
                  {link.icon}
                </span>
              ) : null}

              <span className="flex-1 min-w-0">
                <span className="block text-sm text-slate-800 font-medium group-hover:text-blue-600 transition-colors truncate">
                  {link.label}
                </span>
                {link.subtitle && (
                  <span className="block text-xs text-slate-400 truncate">{link.subtitle}</span>
                )}
              </span>

              <ExternalLink
                size={13}
                className="text-slate-300 group-hover:text-blue-500 flex-shrink-0 transition-colors"
              />
            </a>
          ))
        )}
      </div>
    </div>
  );
}
