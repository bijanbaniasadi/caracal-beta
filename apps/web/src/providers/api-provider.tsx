'use client';

/**
 * ApiProvider — centralized API configuration context.
 *
 * Provides:
 *   baseUrl  — resolved from NEXT_PUBLIC_API_URL at runtime; falls back to
 *              http://localhost:3001 so local dev works without env setup.
 *   isDev    — true when process.env.NODE_ENV === 'development'; used by
 *              hooks to decide whether to surface request-ids in toast messages.
 *
 * Place this as the outermost provider in the tree so all hooks can read it.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

// ─── Shape ───────────────────────────────────────────────────────────────────

export interface ApiConfig {
  baseUrl: string;
  isDev: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ApiContext = createContext<ApiConfig | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ApiProvider({ children }: { children: ReactNode }) {
  const config = useMemo<ApiConfig>(
    () => ({
      baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
      isDev: process.env.NODE_ENV === 'development',
    }),
    // Empty deps: env vars are constants baked in at build time.
    [],
  );

  return <ApiContext.Provider value={config}>{children}</ApiContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useApiConfig(): ApiConfig {
  const ctx = useContext(ApiContext);
  if (!ctx) {
    throw new Error('useApiConfig must be called inside <ApiProvider>');
  }
  return ctx;
}
