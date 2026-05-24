'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listBinUploads } from '@/lib/api/admin-client';
import type { BinUploadRecord, ListParams, PaginatedList } from '@/lib/api/admin-types';

export const adminUploadsKey = (params?: ListParams) =>
  ['admin', 'uploads', params] as const;

/**
 * Fetches the bin upload status table.
 *
 * Backed by GET /api/admin/bin-uploads — currently returns empty list.
 */
export function useAdminUploads(
  params?: ListParams,
): UseQueryResult<PaginatedList<BinUploadRecord>, Error> {
  return useQuery<PaginatedList<BinUploadRecord>, Error>({
    queryKey: adminUploadsKey(params),
    queryFn: () => listBinUploads(params),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1_000,
    retry: false,
  });
}
