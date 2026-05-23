'use client';

/**
 * useApiHealth — TanStack Query wrapper for GET /health.
 *
 * The health endpoint returns plain JSON (no ApiEnvelope), with a 10-second
 * stale window so a status badge stays reasonably fresh without hammering
 * the server.
 *
 * Usage — status badge:
 *   const { data, isLoading } = useApiHealth();
 *   if (isLoading) return '…';
 *   return data?.status === 'ok' ? '🟢 Online' : '🔴 Degraded';
 *
 * Usage — auto-polling (e.g. a system health page):
 *   const health = useApiHealth({ refetchInterval: 30_000 });
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getHealth } from '@/lib/api';
import type { ApiHealth } from '@/lib/api';

// ─── Query key ────────────────────────────────────────────────────────────────

/** Stable query key. Import this to invalidate from other hooks if needed. */
export const healthQueryKey = ['api', 'health'] as const;

// ─── Options ─────────────────────────────────────────────────────────────────

export interface UseApiHealthOptions {
  /**
   * Polling interval in ms. Pass false (default) to disable polling.
   * Useful for a live health-status page.
   */
  refetchInterval?: number | false;
  /**
   * Set to false to prevent the query from firing automatically.
   * Default: true.
   */
  enabled?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useApiHealth(
  options: UseApiHealthOptions = {},
): UseQueryResult<ApiHealth, Error> {
  const { refetchInterval = false, enabled = true } = options;

  return useQuery<ApiHealth, Error>({
    queryKey: healthQueryKey,
    queryFn: getHealth,
    staleTime: 10_000,   // Health status: treat data fresh for 10 s.
    gcTime: 60_000,      // Keep in cache 1 min after last subscriber.
    retry: 1,            // One retry on failure (e.g. transient network blip).
    refetchInterval: refetchInterval !== false && refetchInterval > 0
      ? refetchInterval
      : false,
    enabled,
  });
}
