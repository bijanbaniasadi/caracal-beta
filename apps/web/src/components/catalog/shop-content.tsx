'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useCategories } from '@/hooks/queries/use-categories';
import { useProductSearch, useProducts } from '@/hooks/queries/use-products';
import type { SortOption } from '@/lib/api/catalog-types';

import { CategoryNav, CategoryNavSkeleton } from './category-nav';
import { ProductGrid } from './product-grid';
import { SearchBar } from './search-bar';
import { SortSelect } from './sort-select';

export function ShopContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const q = searchParams.get('q') ?? '';
  const categorySlug = searchParams.get('category') ?? null;
  const sort = (searchParams.get('sort') ?? 'featured') as SortOption;
  const [inputValue, setInputValue] = useState(q);

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
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [searchParams, pathname, router]
  );

  const handleSearch = useCallback(
    (value: string) => {
      setInputValue(value);
      updateParams({ q: value });
    },
    [updateParams]
  );

  const handleCategory = useCallback(
    (slug: string | null) => {
      updateParams({ category: slug });
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (value: SortOption) => {
      updateParams({ sort: value });
    },
    [updateParams]
  );

  const isSearching = q.trim().length > 0;
  const productListResult = useProducts(
    isSearching ? {} : { categorySlug: categorySlug ?? undefined, sort, limit: 24 }
  );
  const productSearchResult = useProductSearch(
    isSearching ? { q, categorySlug: categorySlug ?? undefined, sort, limit: 24 } : { q: '' }
  );
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = isSearching
    ? productSearchResult
    : productListResult;

  const products = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const totalLoaded = products.length;
  const totalAvailable = data?.pages[0]?.pagination.total;
  const { data: categories, isLoading: catsLoading } = useCategories();

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="space-y-3 lg:rounded-lg lg:border lg:border-white/10 lg:bg-white/5 lg:p-4">
          <p className="hidden font-technical text-xs font-semibold uppercase tracking-widest text-brand-muted lg:block">
            Categories
          </p>
          {catsLoading ? (
            <CategoryNavSkeleton />
          ) : categories && categories.length > 0 ? (
            <CategoryNav
              categories={categories}
              activeSlug={categorySlug}
              onSelect={handleCategory}
            />
          ) : null}
        </div>
      </aside>

      <section className="min-w-0 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar value={inputValue} onChange={handleSearch} />
          <SortSelect value={sort} onChange={handleSort} />
        </div>

        {!isLoading && totalLoaded > 0 && (
          <p className="text-xs text-brand-muted">
            {isSearching
              ? `${totalAvailable ?? totalLoaded} result${
                  (totalAvailable ?? totalLoaded) === 1 ? '' : 's'
                } for "${q}"`
              : `${totalLoaded} of ${totalAvailable ?? totalLoaded} product${
                  (totalAvailable ?? totalLoaded) === 1 ? '' : 's'
                } loaded`}
            {hasNextPage && ' - load more below'}
          </p>
        )}

        <ProductGrid products={products} isLoading={isLoading} />

        {hasNextPage && (
          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className={[
                'rounded-md border border-white/20 px-6 py-2.5 text-sm font-medium text-brand-text',
                'transition-colors hover:bg-white/5 focus:outline-none focus:ring-2',
                'focus:ring-brand-orange focus:ring-offset-brand-bg focus:ring-offset-2',
                isFetchingNextPage ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
