'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listRequestQueue } from '@/lib/api/admin-client';
import type { ListParams, PaginatedList, RequestQueueRow } from '@/lib/api/admin-types';

export const adminRequestsKey = (params?: ListParams) =>
  ['admin', 'requests', params] as const;

/**
 * Fetches the customer request queue: quote requests + product inquiries that
 * are in an actionable state (NEW or IN_REVIEW), newest first.
 *
 * Backed by GET /api/admin/request-queue — currently returns empty list.
 */
export function useAdminRequests(
  params?: ListParams,
): UseQueryResult<PaginatedList<RequestQueueRow>, Error> {
  return useQuery<PaginatedList<RequestQueueRow>, Error>({
    queryKey: adminRequestsKey(params),
    queryFn: () => listRequestQueue(params),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1_000,
    retry: false,
  });
}
