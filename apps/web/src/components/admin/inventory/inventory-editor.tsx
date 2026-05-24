'use client';

import { useState } from 'react';
import type { AdminInventoryItem, AdminInventoryUpdate } from '@/lib/api/admin-types';
import type { InventoryStatus } from '@/lib/api/catalog-types';
import {
  AdminTable, AdminThead, AdminTh, AdminTbody, AdminTr, AdminTd,
  AdminTableEmpty, AdminPagination,
} from '@/components/admin/ui/admin-table';
import { InventoryStatusBadge } from '@/components/admin/ui/admin-badge';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';
import { useUpdateInventory } from '@/hooks/queries/use-admin-inventory';
import { useToastContext } from '@/lib/toast/context';

// ─── Inline edit row ──────────────────────────────────────────────────────────

const STATUS_OPTIONS: InventoryStatus[] = [
  'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'DISCONTINUED',
];

const selectCls =
  'rounded-lg border border-white/10 bg-[#0f1923] px-2 py-1.5 text-xs text-brand-text outline-none focus:border-brand-orange/50';

function EditableRow({ item }: { item: AdminInventoryItem }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<InventoryStatus>(item.status);
  const [qty, setQty] = useState(String(item.quantityOnHand));
  const [reorder, setReorder] = useState(String(item.reorderPoint ?? ''));
  const { mutateAsync, isPending } = useUpdateInventory();
  const { addToast } = useToastContext();

  const save = async () => {
    const update: AdminInventoryUpdate = {
      status,
      quantityOnHand: parseInt(qty, 10) || 0,
      reorderPoint: reorder ? parseInt(reorder, 10) : undefined,
    };
    try {
      await mutateAsync({ productId: item.productId, update });
      addToast({ variant: 'success', title: `${item.productName} updated` });
      setEditing(false);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Update failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const cancel = () => {
    setStatus(item.status);
    setQty(String(item.quantityOnHand));
    setReorder(String(item.reorderPoint ?? ''));
    setEditing(false);
  };

  return (
    <AdminTr>
      {/* Product */}
      <AdminTd>
        <p className="max-w-[200px] truncate font-medium text-brand-text">
          {item.productName}
        </p>
        {item.sku && (
          <code className="text-xs text-brand-muted">{item.sku}</code>
        )}
      </AdminTd>

      {/* Status */}
      <AdminTd>
        {editing ? (
          <select
            className={selectCls}
            value={status}
            onChange={(e) => setStatus(e.target.value as InventoryStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <InventoryStatusBadge status={item.status} />
        )}
      </AdminTd>

      {/* Qty on hand */}
      <AdminTd>
        {editing ? (
          <input
            type="number"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-20 rounded-lg border border-white/10 bg-[#0f1923] px-2 py-1.5 text-xs text-brand-text outline-none focus:border-brand-orange/50"
          />
        ) : (
          <span className="font-mono text-sm text-brand-text">
            {item.quantityOnHand}
          </span>
        )}
      </AdminTd>

      {/* Reserved */}
      <AdminTd>
        <span className="font-mono text-sm text-brand-muted">
          {item.quantityReserved}
        </span>
      </AdminTd>

      {/* Available */}
      <AdminTd>
        <span
          className={[
            'font-mono text-sm font-semibold',
            item.quantityAvailable > 0 ? 'text-brand-green' : 'text-red-400',
          ].join(' ')}
        >
          {item.quantityAvailable}
        </span>
      </AdminTd>

      {/* Reorder point */}
      <AdminTd>
        {editing ? (
          <input
            type="number"
            min="0"
            value={reorder}
            onChange={(e) => setReorder(e.target.value)}
            className="w-16 rounded-lg border border-white/10 bg-[#0f1923] px-2 py-1.5 text-xs text-brand-text outline-none focus:border-brand-orange/50"
            placeholder="—"
          />
        ) : (
          <span className="font-mono text-sm text-brand-muted">
            {item.reorderPoint ?? '—'}
          </span>
        )}
      </AdminTd>

      {/* Alert */}
      <AdminTd>
        {item.reorderPoint !== null &&
        item.quantityAvailable <= item.reorderPoint ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-400">
            ⚠ Reorder
          </span>
        ) : null}
      </AdminTd>

      {/* Actions */}
      <AdminTd className="text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-brand-muted hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => void save()}
              className="rounded-md bg-brand-orange px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? '…' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-brand-text"
          >
            Edit
          </button>
        )}
      </AdminTd>
    </AdminTr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface InventoryEditorProps {
  items: AdminInventoryItem[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPage: (p: number) => void;
}

export function InventoryEditor({
  items, isLoading, total, page, pageSize, totalPages, onPage,
}: InventoryEditorProps) {
  if (isLoading) return <AdminTableSkeleton rows={10} cols={8} />;

  const alertCount = items.filter(
    (i) => i.reorderPoint !== null && i.quantityAvailable <= i.reorderPoint,
  ).length;

  return (
    <>
      {alertCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm">
          <span className="text-amber-400">⚠</span>
          <span className="font-medium text-amber-300">
            {alertCount} product{alertCount !== 1 ? 's' : ''} at or below reorder point
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>Product</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>On Hand</AdminTh>
              <AdminTh>Reserved</AdminTh>
              <AdminTh>Available</AdminTh>
              <AdminTh>Reorder At</AdminTh>
              <AdminTh>Alert</AdminTh>
              <AdminTh className="text-right">Actions</AdminTh>
            </tr>
          </AdminThead>

          {items.length === 0 ? (
            <AdminTableEmpty message="No inventory records found" colSpan={8} />
          ) : (
            <AdminTbody>
              {items.map((item) => (
                <EditableRow key={item.productId} item={item} />
              ))}
            </AdminTbody>
          )}
        </AdminTable>

        {totalPages > 1 && (
          <AdminPagination
            page={page} totalPages={totalPages}
            total={total} pageSize={pageSize} onPage={onPage}
          />
        )}
      </div>
    </>
  );
}
