'use client';

import type { Category } from '@/lib/api/catalog-types';

interface CategoryNavProps {
  categories: Category[];
  activeSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export function CategoryNav({ categories, activeSlug, onSelect }: CategoryNavProps) {
  const active = categories.filter((c) => c.isActive);

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
      role="group"
      aria-label="Filter by category"
    >
      {/* All products pill */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={pill(activeSlug === null)}
        aria-pressed={activeSlug === null}
      >
        All
      </button>

      {active.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat.slug)}
          className={pill(activeSlug === cat.slug)}
          aria-pressed={activeSlug === cat.slug}
        >
          {cat.name}
          {cat.counts.products > 0 && (
            <span
              className={[
                'ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
                activeSlug === cat.slug ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500',
              ].join(' ')}
            >
              {cat.counts.products}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function pill(active: boolean): string {
  return [
    'inline-flex shrink-0 items-center justify-between rounded-full px-3 py-1.5 text-sm font-medium lg:w-full lg:rounded-md',
    'transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
    active
      ? 'bg-slate-900 text-white'
      : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50',
  ].join(' ');
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function CategoryNavSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {[60, 80, 70, 90, 65].map((w, i) => (
        <div
          key={i}
          className="h-8 animate-pulse rounded-full bg-slate-100"
          style={{ width: `${w}px` }}
        />
      ))}
    </div>
  );
}
