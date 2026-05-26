'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  listProjectedProducts,
  searchProjectedProducts,
} from '@/lib/api/projection-catalog-client';
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
}

function pageParamsFromSearch(
  searchParams: URLSearchParams,
  fixed: { category?: string; manufacturer?: string }
): ProjectionCatalogParams {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const sort = (searchParams.get('sort') ?? 'featured') as ProjectionSortOption;
  return {
    q: searchParams.get('q') ?? undefined,
    category: fixed.category ?? searchParams.get('category') ?? undefined,
    manufacturer: fixed.manufacturer ?? searchParams.get('manufacturer') ?? undefined,
    inStock: searchParams.get('stock') === 'in',
    page: Number.isFinite(page) ? page : 1,
    limit: 24,
    sort,
  };
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
}: ProjectionCatalogBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fixed = useMemo(
    () => ({ category: fixedCategory, manufacturer: fixedManufacturer }),
    [fixedCategory, fixedManufacturer]
  );
  const initialParams = useMemo(
    () => pageParamsFromSearch(searchParams, fixed),
    [fixed, searchParams]
  );
  const [params, setParams] = useState<ProjectionCatalogParams>(initialParams);
  const [page, setPage] = useState<ProjectionProductPage<
    ProjectionProduct | ProjectionSearchProduct
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setParams(initialParams);
  }, [initialParams]);

  useEffect(() => {
    let active = true;
    const requestParams = { ...params };
    const load = async () => {
      setError(null);
      try {
        const result =
          mode === 'search' || requestParams.q
            ? await searchProjectedProducts(requestParams)
            : await listProjectedProducts(requestParams);
        if (active) setPage(result);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Catalog projection is unavailable.');
          setPage(null);
        }
      }
    };

    const timer = window.setTimeout(
      () => {
        startTransition(() => {
          void load();
        });
      },
      mode === 'search' ? 180 : 0
    );

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [mode, params]);

  const setFilter = (patch: Partial<ProjectionCatalogParams>) => {
    const next = { ...params, ...patch, page: patch.page ?? 1 };
    setParams(next);
    updateUrl(router, pathname, next, fixed);
  };

  const items = page?.items ?? [];
  const pagination = page?.pagination;

  return (
    <div className="space-y-8">
      <section className="border-b border-white/10 pb-6">
        <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange">
          Projection catalog
        </p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-brand-text">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">{subtitle}</p>
          </div>
          <div className="rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
            Preview path. Legacy shop remains active.
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-[1fr_180px_150px]">
        <input
          value={params.q ?? ''}
          onChange={(event) => setFilter({ q: event.target.value || undefined })}
          placeholder="Search by product, tool, category, or manufacturer"
          className="h-11 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-brand-text outline-none transition focus:border-brand-orange"
          aria-label="Search projected catalog"
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

      {isPending && !page ? <ProjectionGridSkeleton /> : null}

      {!isPending && !error && items.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-6 py-14 text-center">
          <p className="text-sm font-semibold text-brand-text">No projected products found</p>
          <p className="mt-2 text-sm text-brand-muted">
            The public projection may be empty until admin-published catalog products are projected.
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
                disabled={(params.page ?? 1) <= 1 || isPending}
                onClick={() => setFilter({ page: Math.max((params.page ?? 1) - 1, 1) })}
                className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-brand-text disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!pagination?.hasMore || isPending}
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
