'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  enqueueCorpusScan,
  getCorpusMetrics,
  getLatestCorpusRun,
  listCorpusClusters,
  listCorpusFiles,
  listOriModPairs,
  listUnknownFamilies,
  pauseCorpus,
  resetFailedCorpusJobs,
  resumeCorpus,
} from '@/lib/api/admin-client';
import type {
  EcuAnalysisRun,
  EcuFileCluster,
  EcuCorpusFile,
  EcuOriModPair,
  EcuUnknownFamily,
  ListParams,
  PaginatedList,
} from '@/lib/api/admin-types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const corpusKeys = {
  all: ['admin', 'corpus'] as const,
  latestRun: ['admin', 'corpus', 'latest-run'] as const,
  metrics: (runId?: string) => ['admin', 'corpus', 'metrics', runId] as const,
  files: (params?: ListParams & { extension?: string; family?: string; oem?: string }) =>
    ['admin', 'corpus', 'files', params] as const,
  clusters: (params?: ListParams) => ['admin', 'corpus', 'clusters', params] as const,
  unknownFamilies: (params?: ListParams) =>
    ['admin', 'corpus', 'unknown-families', params] as const,
  oriModPairs: (params?: ListParams) => ['admin', 'corpus', 'ori-mod-pairs', params] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useLatestCorpusRun(
  pollIntervalMs?: number,
): UseQueryResult<EcuAnalysisRun, Error> {
  return useQuery({
    queryKey: corpusKeys.latestRun,
    queryFn: getLatestCorpusRun,
    staleTime: 15_000,
    refetchInterval: pollIntervalMs,
    retry: false,
  });
}

export function useCorpusMetrics(
  runId?: string,
  pollIntervalMs?: number,
): UseQueryResult<unknown, Error> {
  return useQuery({
    queryKey: corpusKeys.metrics(runId),
    queryFn: () => getCorpusMetrics(runId),
    staleTime: 15_000,
    refetchInterval: pollIntervalMs,
    retry: false,
  });
}

export function useCorpusFiles(
  params?: ListParams & { extension?: string; family?: string; oem?: string },
): UseQueryResult<PaginatedList<EcuCorpusFile>, Error> {
  return useQuery({
    queryKey: corpusKeys.files(params),
    queryFn: () => listCorpusFiles(params),
    staleTime: 30_000,
    retry: false,
  });
}

export function useCorpusClusters(
  params?: ListParams,
): UseQueryResult<PaginatedList<EcuFileCluster>, Error> {
  return useQuery({
    queryKey: corpusKeys.clusters(params),
    queryFn: () => listCorpusClusters(params),
    staleTime: 30_000,
    retry: false,
  });
}

export function useUnknownFamilies(
  params?: ListParams,
): UseQueryResult<PaginatedList<EcuUnknownFamily>, Error> {
  return useQuery({
    queryKey: corpusKeys.unknownFamilies(params),
    queryFn: () => listUnknownFamilies(params),
    staleTime: 30_000,
    retry: false,
  });
}

export function useOriModPairs(
  params?: ListParams,
): UseQueryResult<PaginatedList<EcuOriModPair>, Error> {
  return useQuery({
    queryKey: corpusKeys.oriModPairs(params),
    queryFn: () => listOriModPairs(params),
    staleTime: 30_000,
    retry: false,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useEnqueueCorpusScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rootPath, maxFiles }: { rootPath: string; maxFiles?: number }) =>
      enqueueCorpusScan(rootPath, maxFiles),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: corpusKeys.all });
    },
  });
}

export function usePauseCorpus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => pauseCorpus(runId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: corpusKeys.latestRun });
    },
  });
}

export function useResumeCorpus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => resumeCorpus(runId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: corpusKeys.latestRun });
    },
  });
}

export function useResetFailedCorpusJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => resetFailedCorpusJobs(runId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: corpusKeys.all });
    },
  });
}
