'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  approveReviewMatch,
  archiveReviewItem,
  createMasterFromReview,
  getAdminAuditVisibility,
  getCurationDashboard,
  listReviewQueue,
  mergeReviewDuplicate,
  refingerprintReviewItem,
  rejectReviewItem,
} from '@/lib/api/admin-curation-client';
import type {
  AdminAuditRecord,
  AdminReviewDashboard,
  AdminReviewQueueItem,
  ReviewCreateMasterInput,
} from '@/lib/api/admin-curation-types';
import {
  AdminCurationFrame,
  EmptyPanel,
  ErrorPanel,
  LoadingRows,
  StatTile,
  centsLabel,
} from './curation-ui';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

function arrayCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function ReviewWorkflowPanel() {
  const [dashboard, setDashboard] = useState<AdminReviewDashboard | null>(null);
  const [queue, setQueue] = useState<AdminReviewQueueItem[]>([]);
  const [audit, setAudit] = useState<AdminAuditRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardResult, queueResult, auditResult] = await Promise.all([
        getCurationDashboard(),
        listReviewQueue('open', 25),
        getAdminAuditVisibility(20),
      ]);
      setDashboard(dashboardResult);
      setQueue(queueResult);
      setAudit(auditResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review workflow could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const action = async (id: string, handler: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await handler();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const duplicateCount =
    dashboard?.duplicateCandidates.reduce((sum, item) => sum + item.duplicateCount, 0) ?? 0;
  const failureCount = dashboard?.ingestionFailureQueue.length ?? 0;

  return (
    <AdminCurationFrame
      title="Review queue"
      description="Curate staged vendor products into master catalog records without publishing automatically."
    >
      {error && <ErrorPanel message={error} />}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Pending review" value={dashboard?.pendingReviewCount ?? 0} tone="warn" />
        <StatTile
          label="High confidence"
          value={dashboard?.highConfidenceCandidates.length ?? 0}
          tone="good"
        />
        <StatTile
          label="Duplicate raw candidates"
          value={duplicateCount}
          tone={duplicateCount ? 'warn' : 'good'}
        />
        <StatTile
          label="Ingestion failures"
          value={failureCount}
          tone={failureCount ? 'bad' : 'good'}
        />
      </div>

      {loading ? <LoadingRows rows={5} /> : null}

      {!loading && queue.length === 0 ? (
        <EmptyPanel message="No open review items are waiting." />
      ) : null}

      <div className="space-y-4">
        {queue.map((item) => (
          <ReviewQueueCard
            key={item.id}
            item={item}
            busy={busyId === item.id}
            onApprove={(notes) =>
              action(item.id, () =>
                approveReviewMatch(item.id, {
                  masterProductId: item.suggestedProduct?.id,
                  confidence: item.suggestedConfidence ?? undefined,
                  notes,
                })
              )
            }
            onReject={(reason) => action(item.id, () => rejectReviewItem(item.id, reason))}
            onArchive={(reason) => action(item.id, () => archiveReviewItem(item.id, reason))}
            onMerge={(canonicalRawProductId, reason) =>
              action(item.id, () =>
                mergeReviewDuplicate(item.id, { canonicalRawProductId, reason })
              )
            }
            onRefingerprint={(reason) =>
              action(item.id, () => refingerprintReviewItem(item.id, reason))
            }
            onCreate={(input) => action(item.id, () => createMasterFromReview(item.id, input))}
          />
        ))}
      </div>

      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <h2 className="text-sm font-semibold text-brand-text">Recent audit timeline</h2>
        {audit.length > 0 ? (
          <div className="mt-3 divide-y divide-white/10">
            {audit.map((record) => (
              <div
                key={record.id}
                className="grid gap-2 py-3 text-sm md:grid-cols-[160px_1fr_160px]"
              >
                <span className="text-brand-muted">
                  {new Date(record.occurredAt).toLocaleString('en-AE')}
                </span>
                <span className="font-medium text-brand-text">
                  {record.action} {record.entityType}:{record.entityId}
                </span>
                <span className="text-brand-muted">{record.requestId ?? 'no request id'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-brand-muted">No curation audit records yet.</p>
        )}
      </section>
    </AdminCurationFrame>
  );
}

function ReviewQueueCard({
  item,
  busy,
  onApprove,
  onReject,
  onArchive,
  onMerge,
  onRefingerprint,
  onCreate,
}: {
  item: AdminReviewQueueItem;
  busy: boolean;
  onApprove: (notes: string | null) => void;
  onReject: (reason: string) => void;
  onArchive: (reason: string) => void;
  onMerge: (canonicalRawProductId: string, reason: string) => void;
  onRefingerprint: (reason?: string) => void;
  onCreate: (input: ReviewCreateMasterInput) => void;
}) {
  const [reason, setReason] = useState('');
  const [canonicalRawProductId, setCanonicalRawProductId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const defaultSlug = useMemo(() => slugify(item.rawProduct.rawName), [item.rawProduct.rawName]);

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-brand-muted">
            <span className="rounded-full bg-white/5 px-2 py-1">{item.rawProduct.vendorName}</span>
            <span>Raw #{item.rawProductId}</span>
            <span>{arrayCount(item.rawProduct.rawImageUrls)} images</span>
            <span>{item.rawProduct.parsedInStock ? 'In stock' : 'Stock unknown'}</span>
          </div>
          <h2 className="text-base font-semibold text-brand-text">{item.rawProduct.rawName}</h2>
          {item.rawProduct.rawDescription && (
            <p className="line-clamp-2 text-sm leading-6 text-brand-muted">
              {item.rawProduct.rawDescription}
            </p>
          )}
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-brand-muted">Vendor SKU</p>
              <p className="font-mono text-brand-text">{item.rawProduct.vendorSku ?? 'None'}</p>
            </div>
            <div>
              <p className="text-xs text-brand-muted">Parsed price</p>
              <p className="text-brand-text">
                {centsLabel(
                  item.rawProduct.parsedPriceCents,
                  item.rawProduct.parsedCurrency ?? 'USD'
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-muted">Fingerprint</p>
              <p className="break-all font-mono text-xs text-brand-text">
                {item.rawProduct.fingerprint ?? 'Pending'}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-muted">Suggested match</p>
              <p className="text-brand-text">
                {item.suggestedProduct
                  ? `${item.suggestedProduct.name} (${Math.round((item.suggestedConfidence ?? 0) * 100)}%)`
                  : 'No exact match'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Operator note or reason"
            className="h-24 w-full rounded-md border border-white/10 bg-[#0b1218] px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-orange"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || !item.suggestedProduct}
              onClick={() => onApprove(reason || null)}
              className="rounded-md bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-40"
            >
              Approve match
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowCreate((value) => !value)}
              className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-brand-text"
            >
              New master
            </button>
            <button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={() => onReject(reason)}
              className="rounded-md border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 disabled:opacity-40"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={() => onArchive(reason)}
              className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-brand-muted disabled:opacity-40"
            >
              Archive raw
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={canonicalRawProductId}
              onChange={(event) => setCanonicalRawProductId(event.target.value)}
              placeholder="Canonical raw product id"
              className="h-9 rounded-md border border-white/10 bg-[#0b1218] px-3 text-xs text-brand-text outline-none focus:border-brand-orange"
            />
            <button
              type="button"
              disabled={busy || !canonicalRawProductId || !reason.trim()}
              onClick={() => onMerge(canonicalRawProductId, reason)}
              className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-brand-text disabled:opacity-40"
            >
              Merge duplicate
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRefingerprint(reason || undefined)}
            className="w-full rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-brand-text disabled:opacity-40"
          >
            Re-run fingerprint
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateMasterForm
          item={item}
          defaultSlug={defaultSlug}
          disabled={busy}
          onSubmit={(input) => onCreate(input)}
        />
      )}
    </article>
  );
}

function CreateMasterForm({
  item,
  defaultSlug,
  disabled,
  onSubmit,
}: {
  item: AdminReviewQueueItem;
  defaultSlug: string;
  disabled: boolean;
  onSubmit: (input: ReviewCreateMasterInput) => void;
}) {
  const [slug, setSlug] = useState(defaultSlug);
  const [name, setName] = useState(item.rawProduct.rawName);
  const [categoryId, setCategoryId] = useState('');
  const [manufacturerSlug, setManufacturerSlug] = useState('');
  const [manufacturerName, setManufacturerName] = useState('');
  const [fingerprint, setFingerprint] = useState(item.rawProduct.fingerprint ?? '');
  const [description, setDescription] = useState(item.rawProduct.rawDescription ?? '');

  return (
    <form
      className="mt-4 grid gap-3 rounded-lg border border-white/10 bg-black/10 p-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          slug,
          name,
          categoryId,
          manufacturerSlug,
          manufacturerName,
          fingerprint,
          shortDescription: description || null,
          status: 'PENDING_REVIEW',
          createOffer: true,
          notes: 'Created from review queue.',
        });
      }}
    >
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Product name"
        className="h-10 rounded-md border border-white/10 bg-[#0b1218] px-3 text-sm text-brand-text outline-none"
        required
      />
      <input
        value={slug}
        onChange={(event) => setSlug(slugify(event.target.value))}
        placeholder="slug"
        className="h-10 rounded-md border border-white/10 bg-[#0b1218] px-3 text-sm text-brand-text outline-none"
        required
      />
      <input
        value={manufacturerName}
        onChange={(event) => setManufacturerName(event.target.value)}
        placeholder="Manufacturer name"
        className="h-10 rounded-md border border-white/10 bg-[#0b1218] px-3 text-sm text-brand-text outline-none"
        required
      />
      <input
        value={manufacturerSlug}
        onChange={(event) => setManufacturerSlug(slugify(event.target.value))}
        placeholder="manufacturer-slug"
        className="h-10 rounded-md border border-white/10 bg-[#0b1218] px-3 text-sm text-brand-text outline-none"
        required
      />
      <input
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value.replace(/\D/g, ''))}
        placeholder="Category id"
        className="h-10 rounded-md border border-white/10 bg-[#0b1218] px-3 text-sm text-brand-text outline-none"
        required
      />
      <input
        value={fingerprint}
        onChange={(event) => setFingerprint(event.target.value)}
        placeholder="Canonical fingerprint"
        className="h-10 rounded-md border border-white/10 bg-[#0b1218] px-3 text-sm text-brand-text outline-none"
        required
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Short curated description"
        className="min-h-24 rounded-md border border-white/10 bg-[#0b1218] px-3 py-2 text-sm text-brand-text outline-none md:col-span-2"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-md bg-brand-orange px-4 py-2 text-sm font-semibold text-black disabled:opacity-50 md:col-span-2"
      >
        Create master as pending review
      </button>
    </form>
  );
}
