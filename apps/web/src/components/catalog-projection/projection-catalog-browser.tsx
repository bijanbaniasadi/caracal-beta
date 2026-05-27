'use client';

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  listProjectedProducts,
  searchProjectedProducts,
} from '@/lib/api/projection-catalog-client';
import { projectionParamsFromUrlSearchParams } from '@/lib/api/projection-catalog-params';
import type {
  ProjectionCatalogParams,
  ProjectionProduct,
  ProjectionProductPage,
  ProjectionSearchProduct,
  ProjectionSortOption,
} from '@/lib/api/projection-catalog-types';
import { ProjectionProductCard } from './projection-product-card';
import { projectionSortOptions } from './projection-utils';

type CatalogMode = 'home' | 'search' | 'category' | 'manufacturer';

interface ProjectionCatalogBrowserProps {
  mode: CatalogMode;
  fixedCategory?: string;
  fixedManufacturer?: string;
  title: string;
  subtitle: string;
  initialParams?: ProjectionCatalogParams;
  initialPage?: ProjectionProductPage<ProjectionProduct | ProjectionSearchProduct> | null;
  initialError?: string | null;
}

function updateUrl(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  params: ProjectionCatalogParams,
  fixed: { category?: string; manufacturer?: string }
) {
  const next = new URLSearchParams();
  if (params.q) next.set('q', params.q);
  if (params.category && !fixed.category) next.set('category', params.category);
  if (params.manufacturer && !fixed.manufacturer) next.set('manufacturer', params.manufacturer);
  if (params.inStock) next.set('stock', 'in');
  if (params.sort && params.sort !== 'featured') next.set('sort', params.sort);
  if (params.page && params.page > 1) next.set('page', String(params.page));
  const query = next.toString();
  router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
}

export function ProjectionCatalogBrowser({
  mode,
  fixedCategory,
  fixedManufacturer,
  title,
  subtitle,
  initialParams,
  initialPage,
  initialError,
}: ProjectionCatalogBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fixed = useMemo(
    () => ({ category: fixedCategory, manufacturer: fixedManufacturer }),
    [fixedCategory, fixedManufacturer]
  );
  const initialParamsFromUrl = useMemo(
    () => projectionParamsFromUrlSearchParams(searchParams, fixed),
    [fixed, searchParams]
  );
  const [params, setParams] = useState<ProjectionCatalogParams>(
    initialParams ?? initialParamsFromUrl
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setParams(initialParamsFromUrl);
  }, [initialParamsFromUrl]);

  const deferredParams = useDeferredValue(params);
  const queryKey = useMemo(
    () => ['projection-catalog', mode, deferredParams] as const,
    [deferredParams, mode]
  );
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      mode === 'search' || deferredParams.q
        ? searchProjectedProducts(deferredParams)
        : listProjectedProducts(deferredParams),
    initialData: initialPage ?? undefined,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  const setFilter = (patch: Partial<ProjectionCatalogParams>) => {
    const next = { ...params, ...patch, page: patch.page ?? 1 };
    setParams(next);
    startTransition(() => {
      updateUrl(router, pathname, next, fixed);
    });
  };

  const page = query.data ?? null;
  const items = page?.items ?? [];
  const pagination = page?.pagination;
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : 'Catalog is temporarily unavailable. Please retry.'
    : page
      ? null
      : initialError;
  const isBusy = query.isFetching || isPending;
  const loading = (query.isLoading || isBusy) && items.length === 0;

  return (
    <div className="space-y-8">
      <section className="border-b border-white/10 pb-6">
        <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange">
          Professional catalog
        </p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-brand-text">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">{subtitle}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-[1fr_180px_150px]">
        <input
          value={params.q ?? ''}
          onChange={(event) => setFilter({ q: event.target.value || undefined })}
          placeholder="Search by product, tool, category, or manufacturer"
          className="h-11 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-brand-text outline-none transition focus:border-brand-orange"
          aria-label="Search product catalog"
        />
        <select
          value={params.sort ?? 'featured'}
          onChange={(event) => setFilter({ sort: event.target.value as ProjectionSortOption })}
          className="h-11 rounded-md border border-white/10 bg-[#0b1218] px-3 text-sm text-brand-text outline-none transition focus:border-brand-orange"
          aria-label="Sort catalog"
        >
          {projectionSortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="flex h-11 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-brand-text">
          <input
            type="checkbox"
            checked={Boolean(params.inStock)}
            onChange={(event) => setFilter({ inStock: event.target.checked || undefined })}
            className="h-4 w-4 rounded border-white/20 bg-white/5"
          />
          In stock
        </label>
      </section>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? <ProjectionGridSkeleton /> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-6 py-14 text-center">
          <p className="text-sm font-semibold text-brand-text">No products match these filters</p>
          <p className="mt-2 text-sm text-brand-muted">
            Clear filters or contact us for fitment help.
          </p>
        </div>
      ) : null}

      {items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((product) => (
              <ProjectionProductCard key={product.publicId} product={product} />
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-5 text-sm text-brand-muted">
            <span>
              Page {pagination?.page ?? params.page ?? 1}
              {pagination?.total ? ` of ${pagination.totalPages ?? 1}` : ''}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={(params.page ?? 1) <= 1 || isBusy}
                onClick={() => setFilter({ page: Math.max((params.page ?? 1) - 1, 1) })}
                className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-brand-text disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!pagination?.hasMore || isBusy}
                onClick={() => setFilter({ page: (params.page ?? 1) + 1 })}
                className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-brand-text disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProjectionGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border border-white/10">
          <div className="aspect-[4/3] animate-pulse bg-white/5" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-full animate-pulse rounded bg-white/10" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
