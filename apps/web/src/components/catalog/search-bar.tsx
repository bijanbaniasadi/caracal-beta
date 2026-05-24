'use client';

import { useRef } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search products…',
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative flex-1">
      {/* Search icon */}
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        <svg
          className="h-4 w-4 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </span>

      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          'w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-9',
          'text-sm text-slate-900 placeholder:text-slate-400',
          'focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500',
          'transition-colors',
        ].join(' ')}
        aria-label="Search products"
      />

      {/* Clear button */}
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 right-2 flex items-center px-1 text-slate-400 hover:text-slate-600"
          aria-label="Clear search"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
