/**
 * TanStack QueryClient factory.
 *
 * Retry strategy:
 *   - 4xx (client errors) → never retry. The payload won't change without user action.
 *   - 5xx / network errors → exponential backoff, up to MAX_QUERY_RETRIES for
 *     queries and MAX_MUTATION_RETRIES for mutations (mutations are more
 *     conservative because they have side effects).
 *
 * Singleton pattern:
 *   - Server-side: always a fresh instance to prevent cross-request state leaking.
 *   - Client-side: singleton so navigations share the same cache.
 */

import { QueryClient } from '@tanstack/react-query';

import { CaracalApiError } from '@/lib/api/client';

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const MAX_QUERY_RETRIES = 3;
const MAX_MUTATION_RETRIES = 1; // Mutations have side-effects — be conservative.

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shouldRetry(failureCount: number, error: unknown, max: number): boolean {
  if (error instanceof CaracalApiError) {
    // Client errors (4xx) will not change without user action — never retry.
    if (error.status >= 400 && error.status < 500) return false;
  }
  return failureCount < max;
}

function retryDelay(attemptIndex: number): number {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** attemptIndex, MAX_RETRY_DELAY_MS);
}

// ─── Factory ─────────────────────────────────────────────────────────────────

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, err) => shouldRetry(count, err, MAX_QUERY_RETRIES),
        retryDelay,
        staleTime: 30_000,        // Data stays fresh for 30 s by default.
        gcTime: 5 * 60 * 1_000,  // Keep in cache 5 min after last subscriber.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: (count, err) => shouldRetry(count, err, MAX_MUTATION_RETRIES),
        retryDelay,
      },
    },
  });
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let browserQueryClient: QueryClient | undefined;

/**
 * Returns the QueryClient instance appropriate for the current environment.
 *
 * Must be called inside a React component or hook so that `useState`
 * (in QueryProvider) receives a stable reference on the first render.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always a fresh client to avoid cross-request state sharing.
    return makeQueryClient();
  }
  // Browser: reuse the same client across navigations.
  return (browserQueryClient ??= makeQueryClient());
}
