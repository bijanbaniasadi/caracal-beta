'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

import { useProducts, useProductSearch } from '@/hooks/queries/use-products';
import { useCategories } from '@/hooks/queries/use-categories';
import type { SortOption } from '@/lib/api/catalog-types';

import { CategoryNav, CategoryNavSkeleton } from './category-nav';
import { SearchBar } from './search-bar';
import { SortSelect } from './sort-select';
import { ProductGrid } from './product-grid';

// ─── ShopContent ──────────────────────────────────────────────────────────────

export function ShopContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [, startTransition] = useTransition();

  // ── Read filter state from URL ──────────────────────────────────────────
  const q = searchParams.get('q') ?? '';
  const categorySlug = searchParams.get('category') ?? null;
  const sort = (searchParams.get('sort') ?? 'featured') as SortOption;

  // ── Local search input (controlled; URL update is debounced via transition)
  const [inputValue, setInputValue] = useState(q);

  // ── URL updater ──────────────────────────────────────────────────────────
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [searchParams, pathname, router],
  );

  const handleSearch = useCallback(
    (value: string) => {
      setInputValue(value);
      updateParams({ q: value, category: null });
    },
    [updateParams],
  );

  const handleCategory = useCallback(
    (slug: string | null) => {
      updateParams({ category: slug, q: null });
      setInputValue('');
    },
    [updateParams],
  );

  const handleSort = useCallback(
    (value: SortOption) => {
      updateParams({ sort: value });
    },
    [updateParams],
  );

  // ── Data fetching ────────────────────────────────────────────────────────
  const isSearching = q.trim().length > 0;

  const productListResult = useProducts(
    isSearching
      ? {} // disabled when searching
      : { categorySlug: categorySlug ?? undefined, sort },
  );

  const productSearchResult = useProductSearch(
    isSearching
      ? { q, sort }
      : { q: '' }, // q='' → disabled by enabled:false in hook
  );

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    isSearching ? productSearchResult : productListResult;

  const products = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  // ── Categories ───────────────────────────────────────────────────────────
  const { data: categories, isLoading: catsLoading } = useCategories();

  // ── Counts ───────────────────────────────────────────────────────────────
  const totalLoaded = products.length;

  return (
    <div className="space-y-6">
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar value={inputValue} onChange={handleSearch} />
        <SortSelect value={sort} onChange={handleSort} />
      </div>

      {/* ── Category pills ────────────────────────────────────────────────── */}
      {catsLoading ? (
        <CategoryNavSkeleton />
      ) : categories && categories.length > 0 ? (
        <CategoryNav
          categories={categories}
          activeSlug={isSearching ? null : categorySlug}
          onSelect={handleCategory}
        />
      ) : null}

      {/* ── Results count ─────────────────────────────────────────────────── */}
      {!isLoading && totalLoaded > 0 && (
        <p className="text-xs text-slate-400">
          {isSearching
            ? `${totalLoaded} result${totalLoaded === 1 ? '' : 's'} for "${q}"`
            : `${totalLoaded} product${totalLoaded === 1 ? '' : 's'} loaded`}
          {hasNextPage && ' — scroll down to load more'}
        </p>
      )}

      {/* ── Product grid ──────────────────────────────────────────────────── */}
      <ProductGrid products={products} isLoading={isLoading} />

      {/* ── Load more ─────────────────────────────────────────────────────── */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className={[
              'rounded-md border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-700',
              'transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2',
              'focus:ring-slate-500 focus:ring-offset-2',
              isFetchingNextPage ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
