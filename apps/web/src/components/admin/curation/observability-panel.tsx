'use client';

import { useCallback, useEffect, useState } from 'react';
import { getIngestionObservability } from '@/lib/api/admin-curation-client';
import type { IngestionObservability } from '@/lib/api/admin-curation-types';
import { AdminCurationFrame, EmptyPanel, ErrorPanel, LoadingRows, StatTile } from './curation-ui';

export function ObservabilityPanel() {
  const [report, setReport] = useState<IngestionObservability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getIngestionObservability());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ingestion observability could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AdminCurationFrame
      title="Ingestion observability"
      description="Track ingestion success rate, retries, failure categories, backlog, and processing latency."
    >
      {error && <ErrorPanel message={error} />}
      {loading ? <LoadingRows rows={4} /> : null}

      {report && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Success rate"
              value={`${Math.round(report.ingestionSuccessRate.rate * 100)}%`}
              tone={report.ingestionSuccessRate.rate >= 0.95 ? 'good' : 'warn'}
            />
            <StatTile label="Runs sampled" value={report.ingestionSuccessRate.windowSize} />
            <StatTile
              label="Retries/errors"
              value={report.retryCount}
              tone={report.retryCount ? 'warn' : 'good'}
            />
            <StatTile
              label="Avg latency"
              value={
                report.processingLatency.averageMs === null
                  ? 'n/a'
                  : `${report.processingLatency.averageMs} ms`
              }
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-sm font-semibold text-brand-text">Recent ingestion runs</h2>
              {report.recentRuns.length > 0 ? (
                <div className="mt-3 divide-y divide-white/10">
                  {report.recentRuns.map((run) => (
                    <div
                      key={run.id}
                      className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_120px_120px_100px]"
                    >
                      <div>
                        <p className="font-medium text-brand-text">{run.vendorSlug}</p>
                        <p className="text-xs text-brand-muted">
                          {new Date(run.startedAt).toLocaleString('en-AE')}
                        </p>
                      </div>
                      <span
                        className={
                          run.status === 'COMPLETED' ? 'text-emerald-300' : 'text-amber-200'
                        }
                      >
                        {run.status}
                      </span>
                      <span className="text-brand-muted">{run.productsFound} products</span>
                      <span className="text-brand-muted">{run.errorCount} errors</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel message="No ingestion runs are available yet." />
              )}
            </section>

            <div className="space-y-4">
              <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <h2 className="text-sm font-semibold text-brand-text">Failure categories</h2>
                {report.failureCategories.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {report.failureCategories.map((item) => (
                      <div
                        key={item.category}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-brand-muted">{item.category}</span>
                        <span className="font-semibold text-brand-text">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-brand-muted">No categorized failures.</p>
                )}
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <h2 className="text-sm font-semibold text-brand-text">Queue backlog</h2>
                <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-black/20 p-3 text-xs text-brand-muted">
                  {JSON.stringify(report.queueBacklog, null, 2)}
                </pre>
              </section>
            </div>
          </div>
        </div>
      )}
    </AdminCurationFrame>
  );
}
