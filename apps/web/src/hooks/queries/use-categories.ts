'use client';

import { useQuery } from '@tanstack/react-query';
import { getCategories } from '@/lib/api/catalog-client';

// ─── Query key factory ────────────────────────────────────────────────────────

export const categoryKeys = {
  all: ['categories'] as const,
  list: (includeInactive = false) =>
    ['categories', 'list', { includeInactive }] as const,
};

// ─── useCategories ────────────────────────────────────────────────────────────

/**
 * Fetches all active categories from GET /api/categories.
 *
 * Categories are very stable — stale for 5 minutes, kept in cache for 10 min.
 */
export function useCategories(includeInactive = false) {
  return useQuery({
    queryKey: categoryKeys.list(includeInactive),
    queryFn: () => getCategories({ includeInactive: includeInactive || undefined }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}
