'use client';

/**
 * Root provider tree — compose all app-level context providers here.
 *
 * Import <Providers> into app/layout.tsx and wrap the <body> content with it.
 *
 * Provider order (outermost → innermost):
 *
 *   ApiProvider    — baseUrl + isDev flag; must be outermost so all other
 *                    providers and the Toaster can read API config.
 *   ToastProvider  — global notification queue; wraps QueryProvider so that
 *                    mutation hooks can fire toasts from inside TanStack.
 *   QueryProvider  — TanStack QueryClient + ReactQueryDevtools (dev only).
 *
 * <Toaster> is rendered as a sibling to {children} inside QueryProvider so it
 * has access to both ToastContext and ApiContext without extra nesting.
 */

import type { ReactNode } from 'react';

import { Toaster } from '@/components/toaster';
import { ToastProvider } from '@/lib/toast/context';
import { ApiProvider } from './api-provider';
import { QueryProvider } from './query-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ApiProvider>
      <ToastProvider>
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </ToastProvider>
    </ApiProvider>
  );
}
