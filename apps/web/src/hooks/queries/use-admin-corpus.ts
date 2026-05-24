'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  compareCorpusFiles,
  enqueueCorpusScan,
  getCorpusFile,
  getCorpusMetrics,
  getLatestCorpusRun,
  getLabelCandidates,
  getOriModPair,
  listCorpusClusters,
  listCorpusFiles,
  listOriModPairs,
  listUnknownFamilies,
  matchUploadedBin,
  pauseCorpus,
  resetFailedCorpusJobs,
  resumeCorpus,
} from '@/lib/api/admin-client';
import type {
  CorpusMatchResult,
  EcuAnalysisRun,
  EcuFileCluster,
  EcuCorpusFile,
  EcuCorpusFileFull,
  EcuOriModPair,
  EcuOriModPairFull,
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
  file: (id: string) => ['admin', 'corpus', 'file', id] as const,
  clusters: (params?: ListParams) => ['admin', 'corpus', 'clusters', params] as const,
  unknownFamilies: (params?: ListParams) =>
    ['admin', 'corpus', 'unknown-families', params] as const,
  oriModPairs: (params?: ListParams) => ['admin', 'corpus', 'ori-mod-pairs', params] as const,
  oriModPair: (id: string) => ['admin', 'corpus', 'ori-mod-pair', id] as const,
  match: (uploadId: string) => ['admin', 'corpus', 'match', uploadId] as const,
  labelCandidates: (fileId: string) => ['admin', 'corpus', 'label-candidates', fileId] as const,
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

export function useCorpusFile(
  id: string,
  pollIntervalMs?: number,
): UseQueryResult<EcuCorpusFileFull, Error> {
  return useQuery({
    queryKey: corpusKeys.file(id),
    queryFn: () => getCorpusFile(id),
    staleTime: 60_000,
    refetchInterval: pollIntervalMs,
    retry: false,
    enabled: !!id,
  });
}

export function useOriModPair(
  id: string,
): UseQueryResult<EcuOriModPairFull, Error> {
  return useQuery({
    queryKey: corpusKeys.oriModPair(id),
    queryFn: () => getOriModPair(id),
    staleTime: 60_000,
    retry: false,
    enabled: !!id,
  });
}

export function useCorpusMatch(
  uploadId: string,
  enabled = true,
): UseQueryResult<CorpusMatchResult, Error> {
  return useQuery({
    queryKey: corpusKeys.match(uploadId),
    queryFn: () => matchUploadedBin(uploadId),
    staleTime: 120_000,
    retry: false,
    enabled: enabled && !!uploadId,
  });
}

export function useLabelCandidates(
  fileId: string,
): UseQueryResult<unknown, Error> {
  return useQuery({
    queryKey: corpusKeys.labelCandidates(fileId),
    queryFn: () => getLabelCandidates(fileId),
    staleTime: 120_000,
    retry: false,
    enabled: !!fileId,
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

export function useCompareCorpusFiles() {
  return useMutation({
    mutationFn: ({ leftFileId, rightFileId }: { leftFileId: string; rightFileId: string }) =>
      compareCorpusFiles(leftFileId, rightFileId),
  });
}
