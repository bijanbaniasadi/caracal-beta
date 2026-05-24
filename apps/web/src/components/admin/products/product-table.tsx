'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { AdminProductListItem } from '@/lib/api/admin-types';
import {
  AdminTable, AdminThead, AdminTh, AdminTbody, AdminTr, AdminTd,
  AdminTableEmpty, AdminPagination,
} from '@/components/admin/ui/admin-table';
import { ProductStatusBadge, InventoryStatusBadge, AdminBadge } from '@/components/admin/ui/admin-badge';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';
import { ConfirmModal } from '@/components/admin/ui/confirm-modal';
import { useDeleteProduct } from '@/hooks/queries/use-admin-products';
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

export function ProductTable({
  items, isLoading, total, page, pageSize, totalPages, onPage,
}: ProductTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
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

  if (isLoading) return <AdminTableSkeleton rows={8} cols={7} />;

  return (
    <>
      <ConfirmModal
        open={!!deleteId}
        title="Delete product"
        message="This will permanently remove the product. This action cannot be undone."
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={() => { void handleDelete(); }}
        onCancel={() => setDeleteId(null)}
      />

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>Product</AdminTh>
              <AdminTh>SKU</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Stock</AdminTh>
              <AdminTh>Price</AdminTh>
              <AdminTh>Flags</AdminTh>
              <AdminTh className="text-right">Actions</AdminTh>
            </tr>
          </AdminThead>

          {items.length === 0 ? (
            <AdminTableEmpty message="No products found" colSpan={7} />
          ) : (
            <AdminTbody>
              {items.map((product) => (
                <AdminTr key={product.id}>
                  {/* Product name + image */}
                  <AdminTd>
                    <div className="flex items-center gap-3">
                      {product.primaryImageUrl ? (
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white/5">
                          <Image
                            src={product.primaryImageUrl}
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
                        {product.categoryName && (
                          <p className="text-xs text-brand-muted">{product.categoryName}</p>
                        )}
                      </div>
                    </div>
                  </AdminTd>

                  <AdminTd>
                    <code className="font-mono text-xs text-brand-muted">
                      {product.sku ?? '—'}
                    </code>
                  </AdminTd>

                  <AdminTd><ProductStatusBadge status={product.status} /></AdminTd>

                  <AdminTd>
                    <div className="space-y-0.5">
                      <InventoryStatusBadge status={product.inventoryStatus} />
                      <p className="text-xs text-brand-muted">
                        {product.quantityOnHand} on hand
                      </p>
                    </div>
                  </AdminTd>

                  <AdminTd>
                    <p className="font-medium text-brand-text">
                      {formatPrice(product.priceCents)}
                    </p>
                    {product.tradePriceCents && (
                      <p className="text-xs text-violet-400">
                        Trade: {formatPrice(product.tradePriceCents)}
                      </p>
                    )}
                  </AdminTd>

                  <AdminTd>
                    <div className="flex flex-wrap gap-1">
                      {product.tradeOnly && (
                        <AdminBadge variant="violet">Trade</AdminBadge>
                      )}
                      {product.featured && (
                        <AdminBadge variant="orange">★ Featured</AdminBadge>
                      )}
                      {product.b2bEligible && (
                        <AdminBadge variant="sky">B2B</AdminBadge>
                      )}
                    </div>
                  </AdminTd>

                  <AdminTd className="text-right">
                    <div className="flex items-center justify-end gap-2">
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
              ))}
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
