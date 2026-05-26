'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { AdminProductListItem, AdminProductSourceLookup } from '@/lib/api/admin-types';
import {
  AdminTable,
  AdminThead,
  AdminTh,
  AdminTbody,
  AdminTr,
  AdminTd,
  AdminTableEmpty,
  AdminPagination,
} from '@/components/admin/ui/admin-table';
import {
  ProductStatusBadge,
  InventoryStatusBadge,
  AdminBadge,
} from '@/components/admin/ui/admin-badge';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';
import { ConfirmModal } from '@/components/admin/ui/confirm-modal';
import { useDeleteProduct } from '@/hooks/queries/use-admin-products';
import { lookupAdminProductSources } from '@/lib/api/admin-client';
import { useToastContext } from '@/lib/toast/context';

interface ProductTableProps {
  items: AdminProductListItem[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPage: (p: number) => void;
}

function formatPrice(cents: number | null, currency = 'AED') {
  if (cents === null) return '—';
  return `${currency} ${(cents / 100).toFixed(0)}`;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function lookupUrl(product: AdminProductListItem) {
  const query = [product.sku, product.name, product.supplier?.name].filter(Boolean).join(' ');

  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function provenanceLabel(mode: AdminProductListItem['priceProvenance']['mode']) {
  const labels: Record<AdminProductListItem['priceProvenance']['mode'], string> = {
    CURATED: 'Curated',
    PRICE_HISTORY: 'Scraped',
    VENDOR_PRODUCT: 'Vendor',
    SUPPLIER: 'Supplier',
    MANUAL: 'Manual',
  };

  return labels[mode] ?? mode;
}

function provenanceVariant(mode: AdminProductListItem['priceProvenance']['mode']) {
  const variants: Record<
    AdminProductListItem['priceProvenance']['mode'],
    'green' | 'amber' | 'violet' | 'sky' | 'gray'
  > = {
    CURATED: 'green',
    PRICE_HISTORY: 'sky',
    VENDOR_PRODUCT: 'violet',
    SUPPLIER: 'amber',
    MANUAL: 'gray',
  };

  return variants[mode] ?? 'gray';
}

function formatDelta(value: number | null) {
  if (value === null) return 'n/a';

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function needsSourceReview(product: AdminProductListItem) {
  const provenance = product.priceProvenance;

  return (
    provenance.mode === 'SUPPLIER' ||
    provenance.mode === 'MANUAL' ||
    (!provenance.vendorUrl && !provenance.scrapedAt)
  );
}

export function ProductTable({
  items,
  isLoading,
  total,
  page,
  pageSize,
  totalPages,
  onPage,
}: ProductTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sourceLookup, setSourceLookup] = useState<AdminProductSourceLookup | null>(null);
  const [sourceLookupProduct, setSourceLookupProduct] = useState<AdminProductListItem | null>(null);
  const [isSourceLookupLoading, setIsSourceLookupLoading] = useState(false);
  const { mutateAsync: deleteProduct, isPending: isDeleting } = useDeleteProduct();
  const { addToast } = useToastContext();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProduct(deleteId);
      addToast({ variant: 'success', title: 'Product deleted' });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Delete failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleSourceLookup = async (product: AdminProductListItem) => {
    setSourceLookupProduct(product);
    setSourceLookup(null);
    setIsSourceLookupLoading(true);

    try {
      setSourceLookup(await lookupAdminProductSources(product.id));
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Source check failed',
        description: err instanceof Error ? err.message : undefined,
      });
      setSourceLookupProduct(null);
    } finally {
      setIsSourceLookupLoading(false);
    }
  };

  if (isLoading) return <AdminTableSkeleton rows={8} cols={8} />;

  return (
    <>
      <ConfirmModal
        open={!!deleteId}
        title="Delete product"
        message="This will permanently remove the product. This action cannot be undone."
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={() => {
          void handleDelete();
        }}
        onCancel={() => setDeleteId(null)}
      />

      {sourceLookupProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="source-lookup-title"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => {
              setSourceLookupProduct(null);
              setSourceLookup(null);
            }}
          />
          <div className="relative z-10 max-h-[86vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-white/10 bg-[#0f1923] p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2
                  id="source-lookup-title"
                  className="font-display text-lg font-bold text-brand-text"
                >
                  Source check
                </h2>
                <p className="mt-1 text-sm text-brand-muted">{sourceLookupProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSourceLookupProduct(null);
                  setSourceLookup(null);
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-brand-muted transition-colors hover:bg-white/10 hover:text-brand-text"
              >
                Close
              </button>
            </div>

            {isSourceLookupLoading ? (
              <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-6 text-sm text-brand-muted">
                Checking SKU, title, staging rows, and vendor price history...
              </div>
            ) : sourceLookup ? (
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <AdminBadge variant={sourceLookup.summary.needsReview ? 'amber' : 'green'}>
                    {sourceLookup.summary.needsReview ? 'Needs review' : 'Looks matched'}
                  </AdminBadge>
                  <AdminBadge variant="sky">
                    {sourceLookup.summary.candidateCount} candidates
                  </AdminBadge>
                  <AdminBadge variant="violet">
                    {sourceLookup.summary.highConfidenceCount} strong
                  </AdminBadge>
                  {sourceLookup.summary.priceWarningCount > 0 && (
                    <AdminBadge variant="red">
                      {sourceLookup.summary.priceWarningCount} price warnings
                    </AdminBadge>
                  )}
                </div>

                {sourceLookup.summary.recommendations.length > 0 && (
                  <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">
                    {sourceLookup.summary.recommendations.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                )}

                {sourceLookup.candidates.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-sm text-brand-muted">
                    No source candidate was found in staging or vendor price history. Use the Web
                    button to inspect the product manually, then sync it through Catalog Sync before
                    approving a price.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sourceLookup.candidates.map((candidate) => {
                      const checkedAt = formatDate(candidate.scrapedAt);
                      const deltaIsHigh =
                        candidate.priceDeltaPercent !== null &&
                        Math.abs(candidate.priceDeltaPercent) >= 20;

                      return (
                        <div
                          key={`${candidate.kind}:${candidate.id}`}
                          className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <AdminBadge variant={candidate.score >= 60 ? 'green' : 'gray'}>
                                  Score {candidate.score}
                                </AdminBadge>
                                <AdminBadge variant="sky">{candidate.source.name}</AdminBadge>
                                <span className="text-xs text-brand-muted">
                                  {candidate.kind === 'STAGING_PRODUCT'
                                    ? 'Staging'
                                    : 'Vendor history'}
                                </span>
                              </div>
                              <p className="mt-2 max-w-2xl truncate text-sm font-medium text-brand-text">
                                {candidate.title}
                              </p>
                              <p className="mt-1 font-mono text-xs text-brand-muted">
                                {candidate.sku ?? 'No SKU'}
                              </p>
                            </div>
                            {candidate.url && (
                              <a
                                href={candidate.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-sky-400 transition-colors hover:border-sky-400/40 hover:text-sky-300"
                              >
                                Open source
                              </a>
                            )}
                          </div>

                          <div className="mt-3 grid gap-3 text-xs text-brand-muted sm:grid-cols-4">
                            <div>
                              <span className="block uppercase tracking-wider">Market</span>
                              <strong className="text-sm text-brand-text">
                                {formatPrice(
                                  candidate.normalizedPriceCents,
                                  candidate.normalizedCurrency
                                )}
                              </strong>
                            </div>
                            <div>
                              <span className="block uppercase tracking-wider">Delta</span>
                              <strong
                                className={[
                                  'text-sm',
                                  deltaIsHigh ? 'text-red-400' : 'text-brand-text',
                                ].join(' ')}
                              >
                                {formatDelta(candidate.priceDeltaPercent)}
                              </strong>
                            </div>
                            <div>
                              <span className="block uppercase tracking-wider">Status</span>
                              <strong className="text-sm text-brand-text">
                                {candidate.status}
                              </strong>
                            </div>
                            <div>
                              <span className="block uppercase tracking-wider">Checked</span>
                              <strong className="text-sm text-brand-text">
                                {checkedAt ?? 'Not checked'}
                              </strong>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1">
                            {candidate.reasons.map((reason) => (
                              <AdminBadge key={reason} variant="gray">
                                {reason}
                              </AdminBadge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>Product</AdminTh>
              <AdminTh>SKU</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Stock</AdminTh>
              <AdminTh>Price</AdminTh>
              <AdminTh>Source</AdminTh>
              <AdminTh>Flags</AdminTh>
              <AdminTh className="text-right">Actions</AdminTh>
            </tr>
          </AdminThead>

          {items.length === 0 ? (
            <AdminTableEmpty message="No products found" colSpan={8} />
          ) : (
            <AdminTbody>
              {items.map((product) => {
                const provenance = product.priceProvenance;
                const checkedAt = formatDate(provenance.scrapedAt);
                const sourceName =
                  provenance.sourceName ?? product.supplier?.name ?? 'Caracal manual';
                const rowNeedsSourceReview = needsSourceReview(product);

                return (
                  <AdminTr key={product.id}>
                    {/* Product name + image */}
                    <AdminTd>
                      <div className="flex items-center gap-3">
                        {product.images[0]?.url ? (
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white/5">
                            <Image
                              src={product.images[0].url}
                              alt={product.name}
                              fill
                              className="object-contain p-0.5"
                            />
                          </div>
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs text-brand-muted">
                            📦
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="max-w-[200px] truncate font-medium text-brand-text">
                            {product.name}
                          </p>
                          {product.category?.name && (
                            <p className="text-xs text-brand-muted">{product.category.name}</p>
                          )}
                        </div>
                      </div>
                    </AdminTd>

                    <AdminTd>
                      <code className="font-mono text-xs text-brand-muted">
                        {product.sku ?? '—'}
                      </code>
                    </AdminTd>

                    <AdminTd>
                      <ProductStatusBadge status={product.status} />
                    </AdminTd>

                    <AdminTd>
                      <div className="space-y-0.5">
                        <InventoryStatusBadge status={product.inventory.summary.status} />
                        <p className="text-xs text-brand-muted">
                          {product.inventory.summary.quantityOnHand} on hand
                        </p>
                      </div>
                    </AdminTd>

                    <AdminTd>
                      <p className="font-medium text-brand-text">
                        {formatPrice(product.priceCents)}
                      </p>
                      {provenance.normalizedPriceCents !== null && (
                        <p className="text-xs text-brand-muted">
                          Market:{' '}
                          {formatPrice(provenance.normalizedPriceCents, provenance.currency)}
                        </p>
                      )}
                      {product.tradePriceCents && (
                        <p className="text-xs text-violet-400">
                          Trade: {formatPrice(product.tradePriceCents)}
                        </p>
                      )}
                    </AdminTd>

                    <AdminTd>
                      <div className="max-w-[190px] space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <AdminBadge variant={provenanceVariant(provenance.mode)}>
                            {provenanceLabel(provenance.mode)}
                          </AdminBadge>
                          {rowNeedsSourceReview && (
                            <AdminBadge variant="amber">Needs check</AdminBadge>
                          )}
                          <span className="truncate text-xs text-brand-muted">{sourceName}</span>
                        </div>
                        {provenance.vendorSku && (
                          <p className="font-mono text-[11px] text-brand-muted">
                            SKU {provenance.vendorSku}
                          </p>
                        )}
                        {checkedAt && (
                          <p className="text-[11px] text-brand-muted">Checked {checkedAt}</p>
                        )}
                        {provenance.vendorUrl && (
                          <a
                            href={provenance.vendorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-sky-400 hover:text-sky-300"
                          >
                            Open source
                          </a>
                        )}
                      </div>
                    </AdminTd>

                    <AdminTd>
                      <div className="flex flex-wrap gap-1">
                        {product.isTradeOnly && <AdminBadge variant="violet">Trade</AdminBadge>}
                        {product.isFeatured && <AdminBadge variant="orange">★ Featured</AdminBadge>}
                        {product.isB2BEligible && <AdminBadge variant="sky">B2B</AdminBadge>}
                      </div>
                    </AdminTd>

                    <AdminTd className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleSourceLookup(product);
                          }}
                          className="rounded-md border border-amber-400/20 px-2.5 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-400/10"
                        >
                          Check
                        </button>
                        <a
                          href={lookupUrl(product)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-brand-text"
                        >
                          Web
                        </a>
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-brand-text"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteId(product.id)}
                          className="rounded-md border border-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </AdminTd>
                  </AdminTr>
                );
              })}
            </AdminTbody>
          )}
        </AdminTable>

        {totalPages > 1 && (
          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPage={onPage}
          />
        )}
      </div>
    </>
  );
}
