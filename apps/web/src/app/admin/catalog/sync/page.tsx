'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  AdminTable,
  AdminTableEmpty,
  AdminTbody,
  AdminTd,
  AdminTh,
  AdminThead,
  AdminTr,
} from '@/components/admin/ui/admin-table';
import { AdminBadge, InventoryStatusBadge } from '@/components/admin/ui/admin-badge';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';
import {
  countCatalogSyncFailures,
  useApproveCatalogSyncRow,
  useApproveSelectedCatalogSyncRows,
  usePendingCatalogSyncRows,
  useRejectCatalogSyncRow,
  useRejectSelectedCatalogSyncRows,
} from '@/hooks/queries/use-admin-catalog-sync';
import type { AdminCatalogSyncRow } from '@/lib/api/admin-types';
import { useToastContext } from '@/lib/toast/context';

function formatAed(cents: number | null): string {
  if (cents === null) return 'No price';
  return `AED ${(cents / 100).toLocaleString('en-AE', {
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatChange(value: number | null): string {
  if (value === null) return 'No comparison';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function PriceDiff({ row }: { row: AdminCatalogSyncRow }) {
  if (!row.diff.productionProductId) {
    return (
      <div className="space-y-1">
        <AdminBadge variant="sky">New product</AdminBadge>
        <p className="text-xs text-brand-muted">
          Stage: {formatAed(row.normalizedPriceCents)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-brand-muted">
        Current: {formatAed(row.diff.productionPriceCents)}
      </p>
      <p
        className={[
          'text-sm font-semibold',
          row.diff.overThreshold ? 'text-red-400' : 'text-brand-text',
        ].join(' ')}
      >
        Stage: {formatAed(row.normalizedPriceCents)}
      </p>
      <p className={row.diff.overThreshold ? 'text-xs text-red-400' : 'text-xs text-brand-muted'}>
        {formatChange(row.diff.changePercent)}
      </p>
    </div>
  );
}

export default function AdminCatalogSyncPage() {
  const { data = [], isLoading, error } = usePendingCatalogSyncRows();
  const approveRow = useApproveCatalogSyncRow();
  const rejectRow = useRejectCatalogSyncRow();
  const approveSelected = useApproveSelectedCatalogSyncRows();
  const rejectSelected = useRejectSelectedCatalogSyncRows();
  const { addToast } = useToastContext();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const rows = data;
  const selectedIdList = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedCount = selectedIdList.length;
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const isMutating = approveRow.isPending
    || rejectRow.isPending
    || approveSelected.isPending
    || rejectSelected.isPending;

  const clearSelected = useCallback(() => setSelectedIds(new Set()), []);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((current) => {
      if (rows.length === 0) return current;
      if (rows.every((row) => current.has(row.id))) {
        return new Set();
      }
      return new Set(rows.map((row) => row.id));
    });
  }, [rows]);

  const handleApprove = useCallback(async (id: string) => {
    try {
      await approveRow.mutateAsync(id);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      addToast({ variant: 'success', title: 'Product approved' });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Approve failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, [addToast, approveRow]);

  const handleReject = useCallback(async (id: string) => {
    try {
      await rejectRow.mutateAsync(id);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      addToast({ variant: 'success', title: 'Product rejected' });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Reject failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, [addToast, rejectRow]);

  const handleBulkApprove = useCallback(async () => {
    if (selectedIdList.length === 0) return;

    try {
      const results = await approveSelected.mutateAsync(selectedIdList);
      const failures = countCatalogSyncFailures(results);
      clearSelected();
      addToast({
        variant: failures ? 'error' : 'success',
        title: failures ? 'Bulk approve completed with errors' : 'Selected products approved',
        description: failures ? `${failures} row(s) need manual review.` : undefined,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Bulk approve failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, [addToast, approveSelected, clearSelected, selectedIdList]);

  const handleBulkReject = useCallback(async () => {
    if (selectedIdList.length === 0) return;

    try {
      const results = await rejectSelected.mutateAsync(selectedIdList);
      const failures = countCatalogSyncFailures(results);
      clearSelected();
      addToast({
        variant: failures ? 'error' : 'success',
        title: failures ? 'Bulk reject completed with errors' : 'Selected products rejected',
        description: failures ? `${failures} row(s) need manual review.` : undefined,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Bulk reject failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, [addToast, clearSelected, rejectSelected, selectedIdList]);

  if (isLoading) {
    return <AdminTableSkeleton rows={8} cols={8} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm font-medium text-brand-text">
            Pending supplier products
          </p>
          <p className="text-xs text-brand-muted">
            Review staged rows before they become live shop products.
          </p>
        </div>
        <div className="flex-1" />
        {selectedCount > 0 && (
          <span className="text-xs font-medium text-brand-muted">
            {selectedCount} selected
          </span>
        )}
        <button
          type="button"
          onClick={() => void handleBulkReject()}
          disabled={selectedCount === 0 || isMutating}
          className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reject Selected
        </button>
        <button
          type="button"
          onClick={() => void handleBulkApprove()}
          disabled={selectedCount === 0 || isMutating}
          className="rounded-lg bg-brand-orange px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Approve Selected
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error.message}
        </div>
      )}

      <AdminTable>
        <AdminThead>
          <tr>
            <AdminTh className="w-10 px-2">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                aria-label="Select all pending products"
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-brand-orange"
              />
            </AdminTh>
            <AdminTh className="px-2">Name</AdminTh>
            <AdminTh className="px-2">SKU</AdminTh>
            <AdminTh className="px-2">Source</AdminTh>
            <AdminTh className="px-2">Normalized Price</AdminTh>
            <AdminTh className="px-2">Diff</AdminTh>
            <AdminTh className="px-2">Stock Status</AdminTh>
            <AdminTh className="px-2">Last Scraped</AdminTh>
            <AdminTh className="px-2 text-right">Actions</AdminTh>
          </tr>
        </AdminThead>

        {rows.length === 0 ? (
          <AdminTableEmpty message="No pending staged products" colSpan={9} />
        ) : (
          <AdminTbody>
            {rows.map((row) => (
              <AdminTr key={row.id}>
                <AdminTd className="px-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    aria-label={`Select ${row.name}`}
                    className="h-4 w-4 rounded border-white/20 bg-white/5 text-brand-orange"
                  />
                </AdminTd>
                <AdminTd className="px-2">
                  <div className="w-[210px] space-y-1">
                    <p className="truncate font-medium text-brand-text">
                      {row.name}
                    </p>
                    <a
                      href={row.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-muted transition-colors hover:text-brand-orange"
                    >
                      Source page
                    </a>
                  </div>
                </AdminTd>
                <AdminTd className="px-2">
                  <code className="font-mono text-xs text-brand-muted">
                    {row.sku ?? row.externalSku ?? 'Missing'}
                  </code>
                </AdminTd>
                <AdminTd className="px-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-brand-text">{row.source.name}</p>
                    <p className="text-xs text-brand-muted">{row.source.slug}</p>
                  </div>
                </AdminTd>
                <AdminTd className="px-2">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-brand-text">
                      {formatAed(row.normalizedPriceCents)}
                    </p>
                    {row.oldPriceCents !== null && (
                      <p className="text-xs text-brand-muted">
                        Was {formatAed(row.oldPriceCents)}
                      </p>
                    )}
                  </div>
                </AdminTd>
                <AdminTd className="px-2">
                  <PriceDiff row={row} />
                </AdminTd>
                <AdminTd className="px-2">
                  <InventoryStatusBadge status={row.stockStatus} />
                </AdminTd>
                <AdminTd className="px-2">
                  <span className="block w-[92px] text-xs text-brand-muted">
                    {formatDate(row.lastScrapedAt)}
                  </span>
                </AdminTd>
                <AdminTd className="px-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void handleReject(row.id)}
                      disabled={isMutating}
                      className="rounded-md border border-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApprove(row.id)}
                      disabled={isMutating}
                      className="rounded-md bg-brand-orange px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Approve
                    </button>
                  </div>
                </AdminTd>
              </AdminTr>
            ))}
          </AdminTbody>
        )}
      </AdminTable>
    </div>
  );
}
