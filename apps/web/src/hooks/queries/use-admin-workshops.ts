'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listWorkshopLeads } from '@/lib/api/admin-client';
import type { ListParams, PaginatedList, WorkshopLeadRecord } from '@/lib/api/admin-types';

export const adminWorkshopsKey = (params?: ListParams) =>
  ['admin', 'workshops', params] as const;

/**
 * Fetches the workshop consultation leads table.
 *
 * Backed by GET /api/admin/workshop-leads — currently returns empty list.
 */
export function useAdminWorkshops(
  params?: ListParams,
): UseQueryResult<PaginatedList<WorkshopLeadRecord>, Error> {
  return useQuery<PaginatedList<WorkshopLeadRecord>, Error>({
    queryKey: adminWorkshopsKey(params),
    queryFn: () => listWorkshopLeads(params),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1_000,
    retry: false,
  });
}
