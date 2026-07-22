import { useState } from 'react';
import { Link2, Search, ExternalLink } from 'lucide-react';
import { companyLinks } from '../../data/mockData';
import EmptyState from '../ui/EmptyState';

export default function CompanyLinks() {
  const [query, setQuery] = useState('');

  // Filter by search
  const filtered = companyLinks.filter((link) =>
    link.country.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
          <Link2 size={16} className="text-indigo-600" />
        </div>
        <h2 className="text-slate-800 font-semibold text-base">Company Links</h2>
        <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
          Public Holidays
        </span>
      </div>

      {/* Search input */}
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

      {/* Country List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-50 px-2 pb-2" style={{ maxHeight: '340px' }}>
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
              <span className="text-xl flex-shrink-0">{link.flag}</span>
              <span className="flex-1 text-sm text-slate-700 font-medium group-hover:text-blue-600 transition-colors">
                {link.country} Public Holidays
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
