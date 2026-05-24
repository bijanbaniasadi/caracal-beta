'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listIntakeRows } from '@/lib/api/admin-client';
import type { IntakeRow, ListParams, PaginatedList } from '@/lib/api/admin-types';

export const adminIntakeKey = (params?: ListParams) =>
  ['admin', 'intake', params] as const;

/**
 * Fetches the combined intake table (quote requests + product inquiries +
 * workshop leads, normalised to IntakeRow).
 *
 * Backed by GET /api/admin/intake — currently returns empty list.
 */
export function useAdminIntake(
  params?: ListParams,
): UseQueryResult<PaginatedList<IntakeRow>, Error> {
  return useQuery<PaginatedList<IntakeRow>, Error>({
    queryKey: adminIntakeKey(params),
    queryFn: () => listIntakeRows(params),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1_000,
    retry: false,
  });
}
