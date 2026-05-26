'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  approveCatalogSyncRow,
  approveSelectedCatalogSyncRows,
  listPendingCatalogSyncRows,
  rejectCatalogSyncRow,
  rejectSelectedCatalogSyncRows,
} from '@/lib/api/admin-client';
import type {
  AdminCatalogSyncActionResult,
  AdminCatalogSyncRow,
} from '@/lib/api/admin-types';

export const adminCatalogSyncKeys = {
  all: ['admin', 'catalog-sync'] as const,
  pending: ['admin', 'catalog-sync', 'pending'] as const,
};

export function usePendingCatalogSyncRows(): UseQueryResult<AdminCatalogSyncRow[], Error> {
  return useQuery({
    queryKey: adminCatalogSyncKeys.pending,
    queryFn: listPendingCatalogSyncRows,
    staleTime: 20_000,
    retry: false,
  });
}

export function useApproveCatalogSyncRow() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => approveCatalogSyncRow(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminCatalogSyncKeys.all });
    },
  });
}

export function useRejectCatalogSyncRow() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => rejectCatalogSyncRow(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminCatalogSyncKeys.all });
    },
  });
}

export function useApproveSelectedCatalogSyncRows() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => approveSelectedCatalogSyncRows(ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminCatalogSyncKeys.all });
    },
  });
}

export function useRejectSelectedCatalogSyncRows() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => rejectSelectedCatalogSyncRows(ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminCatalogSyncKeys.all });
    },
  });
}

export function countCatalogSyncFailures(results: AdminCatalogSyncActionResult[]): number {
  return results.filter((result) => Boolean(result.error)).length;
}
