'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  enqueueReconciliation,
  getProjectionRuntimeHealth,
  getReconciliationReport,
} from '@/lib/api/admin-curation-client';
import type { ReconciliationReport } from '@/lib/api/admin-curation-types';
import type { ProjectionRuntimeHealth } from '@/lib/api/projection-catalog-types';
import { AdminCurationFrame, EmptyPanel, ErrorPanel, LoadingRows, StatTile } from './curation-ui';

export function ReconciliationPanel() {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [health, setHealth] = useState<ProjectionRuntimeHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextReport, nextHealth] = await Promise.all([
        getReconciliationReport(),
        getProjectionRuntimeHealth().catch(() => null),
      ]);
      setReport(nextReport);
      setHealth(nextHealth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconciliation report could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enqueue = async () => {
    setBusy(true);
    setError(null);
    try {
      await enqueueReconciliation('full-reconcile', 'admin-ui-reconciliation');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconciliation job could not be queued.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminCurationFrame
      title="Projection reconciliation"
      description="Compare PostgreSQL projections, Typesense alias indexing, unpublished offers, and vendor offer integrity."
    >
      {error && <ErrorPanel message={error} />}
      {loading ? <LoadingRows rows={4} /> : null}

      {report && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Projection issues"
              value={report.projectionConsistencyDashboard.length}
              tone={report.projectionConsistencyDashboard.length ? 'bad' : 'good'}
            />
            <StatTile
              label="Unpublished orphans"
              value={report.unpublishedOrphanScan.length}
              tone={report.unpublishedOrphanScan.length ? 'warn' : 'good'}
            />
            <StatTile
              label="Offer integrity issues"
              value={report.vendorOfferIntegrityScan.length}
              tone={report.vendorOfferIntegrityScan.length ? 'warn' : 'good'}
            />
            <StatTile
              label="Projection health"
              value={health?.ok ? 'Healthy' : 'Check'}
              tone={health?.ok ? 'good' : 'warn'}
            />
          </div>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-brand-text">Typesense index status</h2>
                <p className="mt-1 text-sm text-brand-muted">
                  Search checks use the public alias only.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void enqueue()}
                disabled={busy}
                className="h-10 rounded-md bg-brand-orange px-4 text-sm font-semibold text-black disabled:opacity-50"
              >
                {busy ? 'Queueing' : 'Queue full reconciliation'}
              </button>
            </div>
            <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-black/20 p-3 text-xs text-brand-muted">
              {JSON.stringify(report.postgresqlVsSearchMismatchReport, null, 2)}
            </pre>
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <IssueList
              title="Projection consistency"
              empty="No projection consistency issues."
              items={report.projectionConsistencyDashboard}
              render={(item) => `${item.issue}: ${item.slug} (${item.publicId})`}
            />
            <IssueList
              title="Unpublished orphan scan"
              empty="No unpublished products carry active offers."
              items={report.unpublishedOrphanScan}
              render={(item) =>
                `${item.slug} (${item.status}) has ${item.activeOfferCount} active offer(s)`
              }
            />
            <IssueList
              title="Vendor offer integrity"
              empty="No vendor offer integrity issues."
              items={report.vendorOfferIntegrityScan}
              render={(item) => `${item.issue}: offer ${item.offerId} product ${item.productId}`}
            />
          </div>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-semibold text-brand-text">Frontend runtime validation</h2>
            {health ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {health.checks.map((check) => (
                  <div
                    key={check.name}
                    className="rounded-md border border-white/10 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-brand-text">{check.name}</span>
                      <span className={check.ok ? 'text-emerald-300' : 'text-red-200'}>
                        {check.ok ? 'OK' : 'Fail'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-brand-muted">
                Projection health endpoint is unavailable.
              </p>
            )}
          </section>
        </div>
      )}
    </AdminCurationFrame>
  );
}

function IssueList<T>({
  title,
  empty,
  items,
  render,
}: {
  title: string;
  empty: string;
  items: T[];
  render: (item: T) => string;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-sm font-semibold text-brand-text">{title}</h2>
      {items.length === 0 ? (
        <div className="mt-3">
          <EmptyPanel message={empty} />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => (
            <li
              key={index}
              className="rounded-md border border-white/10 px-3 py-2 text-sm text-brand-muted"
            >
              {render(item)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
