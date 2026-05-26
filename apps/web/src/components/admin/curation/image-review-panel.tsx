'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getImageIntegrityReport } from '@/lib/api/admin-curation-client';
import type { ImageIntegrityReport } from '@/lib/api/admin-curation-types';
import { AdminCurationFrame, EmptyPanel, ErrorPanel, LoadingRows, StatTile } from './curation-ui';

export function ImageReviewPanel() {
  const [report, setReport] = useState<ImageIntegrityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getImageIntegrityReport());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image integrity report could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const missingMaster = report?.missingImageDetection.masterProducts.length ?? 0;
  const missingRaw = report?.missingImageDetection.rawProducts.length ?? 0;

  return (
    <AdminCurationFrame
      title="Image review"
      description="Detect duplicate, broken, missing, and locally unverifiable catalog assets before projection."
    >
      {error && <ErrorPanel message={error} />}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Duplicate hashes" value={report?.duplicateImageDetection.length ?? 0} />
        <StatTile
          label="Broken raw images"
          value={report?.brokenImageDetection.length ?? 0}
          tone={report?.brokenImageDetection.length ? 'bad' : 'good'}
        />
        <StatTile
          label="Master products missing images"
          value={missingMaster}
          tone={missingMaster ? 'warn' : 'good'}
        />
        <StatTile
          label="Raw products missing images"
          value={missingRaw}
          tone={missingRaw ? 'warn' : 'good'}
        />
      </div>

      {loading ? <LoadingRows rows={4} /> : null}

      {report && (
        <div className="grid gap-4 xl:grid-cols-2">
          <ReportList
            title="Duplicate image hashes"
            empty="No duplicate image hashes found."
            items={report.duplicateImageDetection}
            render={(item) => (
              <>
                <p className="break-all font-mono text-xs text-brand-text">{item.contentHash}</p>
                <p className="mt-1 text-xs text-brand-muted">
                  {item.imageCount} images: {item.rawImageIds.join(', ')}
                </p>
              </>
            )}
          />
          <ReportList
            title="Broken image downloads"
            empty="No broken raw image downloads found."
            items={report.brokenImageDetection}
            render={(item) => (
              <>
                <p className="font-medium text-brand-text">
                  {item.vendorSlug} raw #{item.rawProductId}
                </p>
                <p className="mt-1 break-all text-xs text-brand-muted">{item.originalUrl}</p>
                {item.downloadError && (
                  <p className="mt-1 text-xs text-red-200">{item.downloadError}</p>
                )}
              </>
            )}
          />
          <ReportList
            title="Master products missing images"
            empty="Every active master product has at least one catalog image."
            items={report.missingImageDetection.masterProducts}
            render={(item) => (
              <>
                <p className="font-medium text-brand-text">{item.name}</p>
                <p className="mt-1 text-xs text-brand-muted">
                  #{item.id} / {item.slug} / {item.status}
                </p>
              </>
            )}
          />
          <ReportList
            title="Local asset verification"
            empty="No local raw assets required verification."
            items={report.localAssetVerification}
            render={(item) => (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-brand-text">Raw image #{item.rawImageId}</p>
                  <span className={item.exists ? 'text-emerald-300' : 'text-red-200'}>
                    {item.exists ? 'Verified' : 'Missing'}
                  </span>
                </div>
                <p className="mt-1 break-all font-mono text-xs text-brand-muted">
                  {item.contentHash ?? 'no hash'} / {item.bytes ?? item.expectedBytes ?? 'unknown'}{' '}
                  bytes
                </p>
                {item.reason && <p className="mt-1 text-xs text-brand-muted">{item.reason}</p>}
              </>
            )}
          />
        </div>
      )}
    </AdminCurationFrame>
  );
}

function ReportList<T>({
  title,
  empty,
  items,
  render,
}: {
  title: string;
  empty: string;
  items: T[];
  render: (item: T) => ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-sm font-semibold text-brand-text">{title}</h2>
      {items.length === 0 ? (
        <div className="mt-3">
          <EmptyPanel message={empty} />
        </div>
      ) : (
        <div className="mt-3 divide-y divide-white/10">
          {items.map((item, index) => (
            <article key={index} className="py-3 text-sm">
              {render(item)}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
