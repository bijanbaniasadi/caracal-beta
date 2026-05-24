'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { cleanupBinAnalysisQueue, getQueueHealth } from '@/lib/api/admin-client';
import type { QueueHealthResponse } from '@/lib/api/admin-types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const queueKeys = {
  health: ['admin', 'queues', 'health'] as const,
};

// ─── Query ────────────────────────────────────────────────────────────────────

/** Polls queue health every `pollIntervalMs` ms (default 10 s). */
export function useQueueHealth(
  pollIntervalMs = 10_000,
): UseQueryResult<QueueHealthResponse, Error> {
  return useQuery({
    queryKey: queueKeys.health,
    queryFn: getQueueHealth,
    staleTime: 5_000,
    refetchInterval: pollIntervalMs,
    retry: false,
  });
}

// ─── Mutation ─────────────────────────────────────────────────────────────────

export function useCleanupQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cleanupBinAnalysisQueue,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queueKeys.health });
    },
  });
}
