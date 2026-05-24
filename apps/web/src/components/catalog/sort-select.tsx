'use client';

import type { SortOption } from '@/lib/api/catalog-types';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="sort-select"
        className="whitespace-nowrap text-sm text-slate-500"
      >
        Sort by
      </label>
      <select
        id="sort-select"
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className={[
          'rounded-md border border-slate-300 bg-white py-2 pl-3 pr-8',
          'text-sm text-slate-900',
          'focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500',
          'transition-colors',
        ].join(' ')}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
