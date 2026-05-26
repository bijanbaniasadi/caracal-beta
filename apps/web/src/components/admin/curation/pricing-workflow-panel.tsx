'use client';

import { useCallback, useState } from 'react';
import { curateProductPrice, getPricingWorkflow } from '@/lib/api/admin-curation-client';
import type { PricingWorkflow } from '@/lib/api/admin-curation-types';
import { AdminCurationFrame, EmptyPanel, ErrorPanel, StatTile, centsLabel } from './curation-ui';

export function PricingWorkflowPanel() {
  const [productId, setProductId] = useState('');
  const [report, setReport] = useState<PricingWorkflow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [priceCents, setPriceCents] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!productId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const next = await getPricingWorkflow(productId.trim());
      setReport(next);
      setSelectedOfferId(
        next.adminSelectedCuratedPrice?.selectedOfferId ?? next.currentLowestVendor?.offerId ?? null
      );
      setPriceCents(
        next.adminSelectedCuratedPrice?.priceCents ?? next.currentLowestVendor?.priceCents ?? ''
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pricing workflow could not be loaded.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  const submit = async () => {
    if (!report || !priceCents.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await curateProductPrice(report.product.id, {
        offerId: selectedOfferId,
        priceCents,
        currency:
          report.currentLowestVendor?.currency ??
          report.adminSelectedCuratedPrice?.currency ??
          'USD',
        reason: reason || null,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Curated price could not be saved.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminCurationFrame
      title="Curated pricing"
      description="Review vendor price history, current lowest vendor, anomalies, and the admin-selected public price."
    >
      {error && <ErrorPanel message={error} />}

      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="grid gap-3 sm:grid-cols-[260px_auto_1fr] sm:items-end">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
              Master product id
            </span>
            <input
              value={productId}
              onChange={(event) => setProductId(event.target.value.replace(/\D/g, ''))}
              className="h-10 w-full rounded-md border border-white/10 bg-[#0b1218] px-3 text-brand-text outline-none focus:border-brand-orange"
              placeholder="123"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || !productId.trim()}
            className="h-10 rounded-md bg-brand-orange px-4 text-sm font-semibold text-black disabled:opacity-50"
          >
            {loading ? 'Loading' : 'Load pricing'}
          </button>
          <p className="text-sm text-brand-muted">
            This workflow writes only curated price selection through admin APIs.
          </p>
        </div>
      </section>

      {!report && !loading ? (
        <EmptyPanel message="Load a master product to review pricing." />
      ) : null}

      {report && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Product" value={report.product.slug} />
            <StatTile
              label="Lowest vendor"
              value={report.currentLowestVendor?.vendorSlug ?? 'None'}
              tone={report.currentLowestVendor ? 'good' : 'warn'}
            />
            <StatTile
              label="Current lowest price"
              value={centsLabel(
                report.currentLowestVendor?.priceCents ?? null,
                report.currentLowestVendor?.currency ?? 'USD'
              )}
            />
            <StatTile
              label="Anomalies"
              value={report.priceAnomalyDetection.length}
              tone={report.priceAnomalyDetection.length ? 'warn' : 'good'}
            />
          </div>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-semibold text-brand-text">Admin selected curated price</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-[220px_220px_1fr_auto] md:items-end">
              <label className="space-y-1 text-sm">
                <span className="text-xs text-brand-muted">Selected offer</span>
                <select
                  value={selectedOfferId ?? ''}
                  onChange={(event) => setSelectedOfferId(event.target.value || null)}
                  className="h-10 w-full rounded-md border border-white/10 bg-[#0b1218] px-3 text-brand-text outline-none"
                >
                  <option value="">Manual price</option>
                  {report.vendorPriceHistoryTimeline.map((offer) => (
                    <option key={offer.offerId} value={offer.offerId}>
                      {offer.vendorSlug} / {centsLabel(offer.currentPriceCents, offer.currency)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs text-brand-muted">Price cents</span>
                <input
                  value={priceCents}
                  onChange={(event) => setPriceCents(event.target.value.replace(/\D/g, ''))}
                  className="h-10 w-full rounded-md border border-white/10 bg-[#0b1218] px-3 text-brand-text outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs text-brand-muted">Reason</span>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="h-10 w-full rounded-md border border-white/10 bg-[#0b1218] px-3 text-brand-text outline-none"
                  placeholder="Operator reason"
                />
              </label>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={loading || !priceCents}
                className="h-10 rounded-md bg-brand-orange px-4 text-sm font-semibold text-black disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-semibold text-brand-text">Vendor price history timeline</h2>
            <div className="mt-3 divide-y divide-white/10">
              {report.vendorPriceHistoryTimeline.map((offer) => (
                <article key={offer.offerId} className="py-4">
                  <div className="grid gap-2 text-sm md:grid-cols-[1fr_160px_120px]">
                    <div>
                      <p className="font-medium text-brand-text">{offer.vendorName}</p>
                      <p className="break-all text-xs text-brand-muted">{offer.vendorUrl}</p>
                    </div>
                    <span className="text-brand-text">
                      {centsLabel(offer.currentPriceCents, offer.currency)}
                    </span>
                    <span className={offer.inStock ? 'text-emerald-300' : 'text-brand-muted'}>
                      {offer.inStock ? 'In stock' : 'Unknown'}
                    </span>
                  </div>
                  {offer.history.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {offer.history.slice(0, 8).map((history) => (
                        <div
                          key={history.id}
                          className="rounded-md border border-white/10 px-3 py-2 text-xs"
                        >
                          <p className="text-brand-text">
                            {centsLabel(history.priceCents, history.currency)}
                          </p>
                          <p className="text-brand-muted">
                            {new Date(history.observedAt).toLocaleDateString('en-AE')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          {report.priceAnomalyDetection.length > 0 && (
            <section className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-4">
              <h2 className="text-sm font-semibold text-amber-100">Price anomaly detection</h2>
              <div className="mt-3 space-y-2">
                {report.priceAnomalyDetection.map((item) => (
                  <div key={`${item.offerId}-${item.type}`} className="text-sm text-amber-100">
                    {item.vendorSlug}: {item.type} ({item.details})
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AdminCurationFrame>
  );
}
