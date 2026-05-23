'use client';

/**
 * QueryProvider — wraps the app in TanStack's QueryClientProvider.
 *
 * Uses useState so the QueryClient is created exactly once per component
 * mount (not recreated on every render, which would clear the cache).
 *
 * ReactQueryDevtools are included only when NODE_ENV === 'development'.
 * Next.js replaces process.env.NODE_ENV at build time so the devtools import
 * is tree-shaken from production bundles.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

import { getQueryClient } from '@/lib/query/client';

export function QueryProvider({ children }: { children: ReactNode }) {
  // getQueryClient is passed as an initializer function (no call) so React
  // only invokes it on the first render — subsequent renders reuse the instance.
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  );
}
