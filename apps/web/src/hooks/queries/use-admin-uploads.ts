'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { getBinUpload, listBinUploads, updateBinUpload } from '@/lib/api/admin-client';
import type {
  AdminBinUpload,
  BinUploadRecord,
  BinUploadUpdateInput,
  ListParams,
  PaginatedList,
} from '@/lib/api/admin-types';

export const adminUploadsKey = (params?: ListParams) =>
  ['admin', 'uploads', params] as const;

export const adminUploadKey = (id: string) =>
  ['admin', 'upload', id] as const;

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

export function useAdminUpload(
  id: string,
  pollIntervalMs?: number,
): UseQueryResult<AdminBinUpload, Error> {
  return useQuery<AdminBinUpload, Error>({
    queryKey: adminUploadKey(id),
    queryFn: () => getBinUpload(id),
    staleTime: 15_000,
    refetchInterval: pollIntervalMs,
    retry: false,
    enabled: !!id,
  });
}

export function useUpdateBinUpload(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BinUploadUpdateInput) => updateBinUpload(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminUploadKey(id) });
      void qc.invalidateQueries({ queryKey: ['admin', 'uploads'] });
    },
  });
}
