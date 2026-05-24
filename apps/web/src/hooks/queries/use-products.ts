'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { getProducts, searchProducts } from '@/lib/api/catalog-client';
import type { ProductListParams } from '@/lib/api/catalog-types';

// ─── Query key factory ────────────────────────────────────────────────────────

export const productKeys = {
  all: ['products'] as const,
  list: (params: ProductListParams) => ['products', 'list', params] as const,
  search: (params: ProductListParams & { q: string }) =>
    ['products', 'search', params] as const,
  detail: (slug: string) => ['products', 'detail', slug] as const,
};

// ─── useProducts ──────────────────────────────────────────────────────────────

/**
 * Infinite-query wrapper for GET /api/products.
 *
 * Each page result carries { items, pagination }. Pass the last page's
 * `pagination.nextCursor` back as the `cursor` param for the next page.
 *
 * @example
 *   const { data, fetchNextPage, hasNextPage } = useProducts({ categorySlug: 'ecu-tools' });
 */
export function useProducts(params: Omit<ProductListParams, 'cursor'> = {}) {
  return useInfiniteQuery({
    queryKey: productKeys.list(params),
    queryFn: ({ pageParam }) =>
      getProducts({ ...params, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : null,
    staleTime: 60_000, // 1 min — product listings change infrequently
  });
}

// ─── useProductSearch ─────────────────────────────────────────────────────────

/**
 * Infinite-query wrapper for GET /api/products/search?q=...
 *
 * Only fires when `q` is a non-empty string.
 */
export function useProductSearch(params: ProductListParams & { q: string }) {
  return useInfiniteQuery({
    queryKey: productKeys.search(params),
    queryFn: ({ pageParam }) =>
      searchProducts({ ...params, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : null,
    enabled: params.q.trim().length > 0,
    staleTime: 30_000,
  });
}
