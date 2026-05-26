'use client';

import { useEffect, useState } from 'react';
import { getProjectionRuntimeHealth } from '@/lib/api/admin-curation-client';
import type { ProjectionRuntimeHealth } from '@/lib/api/projection-catalog-types';

export function ProjectionRuntimePanel() {
  const [health, setHealth] = useState<ProjectionRuntimeHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setHealth(await getProjectionRuntimeHealth());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Projection runtime validation failed.');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange">
            Runtime validation
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-brand-text">
            Projection health
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
            Public catalog checks are served by projection APIs and Typesense alias health only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="h-10 rounded-md border border-white/10 px-4 text-sm font-semibold text-brand-text disabled:opacity-50"
        >
          {loading ? 'Checking' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !health ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
      ) : null}

      {health && (
        <>
          <div
            className={[
              'rounded-lg border px-4 py-3 text-sm font-semibold',
              health.ok
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/20 bg-red-500/10 text-red-200',
            ].join(' ')}
          >
            {health.ok ? 'Projection runtime is healthy' : 'Projection runtime needs attention'}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {health.checks.map((check) => (
              <article
                key={check.name}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-brand-text">{check.name}</h2>
                  <span
                    className={[
                      'rounded-full px-2 py-1 text-xs font-semibold',
                      check.ok
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-red-500/10 text-red-200',
                    ].join(' ')}
                  >
                    {check.ok ? 'OK' : 'Fail'}
                  </span>
                </div>
                {check.details ? (
                  <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-black/20 p-3 text-xs text-brand-muted">
                    {JSON.stringify(check.details, null, 2)}
                  </pre>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
