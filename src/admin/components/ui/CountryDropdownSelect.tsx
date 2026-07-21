import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { WORLD_COUNTRIES } from '../../../data/countriesList';
import type { WorldCountry } from '../../../data/countriesList';


interface CountryDropdownSelectProps {
  selectedCode?: string;
  selectedName?: string;
  onSelect: (country: WorldCountry) => void;
  onClear?: () => void;
  label?: string;
  placeholder?: string;
  error?: string;
}

export default function CountryDropdownSelect({
  selectedCode,
  selectedName,
  onSelect,
  onClear,
  label = 'Select Country from List',
  placeholder = 'Search & select a country (e.g. Lebanon, FR, US)...',
  error,
}: CountryDropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Find currently selected country
  const currentSelected = WORLD_COUNTRIES.find(
    (c) =>
      c.code.toUpperCase() === (selectedCode || '').toUpperCase() ||
      c.name.toLowerCase() === (selectedName || '').toLowerCase()
  );

  // Filter countries by search query (name or 2-letter code)
  const filteredCountries = WORLD_COUNTRIES.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  });

  const renderFlagImage = (code: string, flagEmoji: string) => {
    const lc = code.toLowerCase();
    return (
      <span className="inline-flex items-center justify-center w-6 h-4 bg-slate-100 rounded overflow-hidden shadow-xs shrink-0">
        <img
          src={`https://flagcdn.com/w40/${lc}.png`}
          srcSet={`https://flagcdn.com/w80/${lc}.png 2x`}
          alt={code}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="text-sm leading-none select-none">{flagEmoji}</span>
      </span>
    );
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {label && (
        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}

      {/* Select trigger button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 bg-slate-50 border ${
          error ? 'border-red-500' : isOpen ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-slate-200'
        } rounded-xl text-slate-800 text-sm flex items-center justify-between cursor-pointer hover:bg-white transition-all`}
      >
        {currentSelected ? (
          <div className="flex items-center gap-2.5 min-w-0">
            {renderFlagImage(currentSelected.code, currentSelected.flag)}
            <span className="font-semibold text-slate-800 truncate">{currentSelected.name}</span>
            <span className="text-xs font-mono font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
              {currentSelected.code}
            </span>
          </div>
        ) : selectedName || selectedCode ? (
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedCode && renderFlagImage(selectedCode, '🌐')}
            <span className="font-semibold text-slate-800 truncate">{selectedName || selectedCode}</span>
            {selectedCode && (
              <span className="text-xs font-mono font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                {selectedCode}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 font-normal">{placeholder}</span>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {onClear && (currentSelected || selectedCode || selectedName) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200"
              title="Clear selection"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-violet-600' : ''}`}
          />
        </div>
      </div>

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {/* Popover Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search box inside dropdown */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 backdrop-blur-xs flex items-center gap-2">
            <Search size={16} className="text-slate-400 ml-2 shrink-0" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to filter country or ISO code..."
              className="w-full px-2 py-1.5 text-sm bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* List of countries */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 custom-scrollbar">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No countries found matching "{search}"
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected =
                  currentSelected?.code === c.code ||
                  selectedCode?.toUpperCase() === c.code;
                return (
                  <div
                    key={c.code}
                    onClick={() => {
                      onSelect(c);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`px-4 py-2.5 flex items-center justify-between text-sm cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-violet-50 text-violet-900 font-medium'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {renderFlagImage(c.code, c.flag)}
                      <span className="truncate">{c.name}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {c.code}
                      </span>
                      {isSelected && <Check size={16} className="text-violet-600" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
