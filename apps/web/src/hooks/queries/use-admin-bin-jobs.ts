'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  enqueueBinAnalysisJob,
  getBinAnalysisJob,
  listBinAnalysisJobs,
  retryBinAnalysisJob,
} from '@/lib/api/admin-client';
import type {
  BinAnalysisJob,
  ListParams,
  PaginatedList,
} from '@/lib/api/admin-types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const binJobKeys = {
  all: ['admin', 'bin-jobs'] as const,
  list: (params?: ListParams) => ['admin', 'bin-jobs', 'list', params] as const,
  detail: (id: string) => ['admin', 'bin-jobs', 'detail', id] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useAdminBinJobs(
  params?: ListParams,
  pollIntervalMs?: number,
): UseQueryResult<PaginatedList<BinAnalysisJob>, Error> {
  return useQuery({
    queryKey: binJobKeys.list(params),
    queryFn: () => listBinAnalysisJobs(params),
    staleTime: 10_000,
    refetchInterval: pollIntervalMs,
    retry: false,
  });
}

export function useAdminBinJob(
  id: string,
  pollIntervalMs?: number,
): UseQueryResult<BinAnalysisJob, Error> {
  return useQuery({
    queryKey: binJobKeys.detail(id),
    queryFn: () => getBinAnalysisJob(id),
    staleTime: 5_000,
    refetchInterval: pollIntervalMs,
    enabled: !!id,
    retry: false,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useEnqueueBinJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      uploadId,
      priority = 0,
      force = false,
    }: {
      uploadId: string;
      priority?: number;
      force?: boolean;
    }) => enqueueBinAnalysisJob(uploadId, priority, force),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: binJobKeys.all });
    },
  });
}

export function useRetryBinJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, priority = 0 }: { id: string; priority?: number }) =>
      retryBinAnalysisJob(id, priority),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: binJobKeys.all });
    },
  });
}
