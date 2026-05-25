'use client';

import { useEffect, useState } from 'react';
import type {
  AdminOrder,
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
} from '@/lib/api/admin-types';
import {
  AdminPagination,
  AdminTable,
  AdminTableEmpty,
  AdminTbody,
  AdminTd,
  AdminTh,
  AdminThead,
  AdminTr,
} from '@/components/admin/ui/admin-table';
import { AdminBadge } from '@/components/admin/ui/admin-badge';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';
import { ConfirmModal } from '@/components/admin/ui/confirm-modal';
import {
  useCancelOrder,
  useRefundOrder,
  useUpdateOrder,
} from '@/hooks/queries/use-admin-orders';
import { useToastContext } from '@/lib/toast/context';

interface OrderTableProps {
  items: AdminOrder[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPage: (p: number) => void;
}

const FULFILLMENT_OPTIONS: FulfillmentStatus[] = [
  'UNFULFILLED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

const selectCls =
  'rounded-lg border border-white/10 bg-[#0f1923] px-2 py-1.5 text-xs text-brand-text outline-none focus:border-brand-orange/50';

function money(cents: number, currency = 'AED') {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function humanStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusVariant(
  status: OrderStatus | PaymentStatus | FulfillmentStatus | RefundStatus
): 'green' | 'amber' | 'red' | 'violet' | 'sky' | 'gray' | 'orange' {
  if (status === 'PAID' || status === 'FULFILLED' || status === 'DELIVERED') return 'green';
  if (status === 'FAILED' || status === 'CANCELLED') return 'red';
  if (status === 'REFUND_PENDING' || status === 'REQUESTED' || status === 'PROCESSING') {
    return 'amber';
  }
  if (status === 'PARTIALLY_REFUNDED' || status === 'REFUNDED') return 'violet';
  if (status === 'PENDING' || status === 'PENDING_PAYMENT' || status === 'UNFULFILLED') {
    return 'sky';
  }
  return 'gray';
}

function StatusBadge({
  status,
}: {
  status: OrderStatus | PaymentStatus | FulfillmentStatus | RefundStatus;
}) {
  return <AdminBadge variant={statusVariant(status)}>{humanStatus(status)}</AdminBadge>;
}

function OrderRow({
  order,
  onCancel,
  onRefund,
}: {
  order: AdminOrder;
  onCancel: (order: AdminOrder) => void;
  onRefund: (order: AdminOrder) => void;
}) {
  const [fulfillmentStatus, setFulfillmentStatus] = useState(order.fulfillmentStatus);
  const { mutateAsync: updateOrder, isPending } = useUpdateOrder(order.id);
  const { addToast } = useToastContext();

  useEffect(() => {
    setFulfillmentStatus(order.fulfillmentStatus);
  }, [order.fulfillmentStatus]);

  async function changeFulfillment(nextStatus: FulfillmentStatus) {
    setFulfillmentStatus(nextStatus);
    try {
      await updateOrder({ fulfillmentStatus: nextStatus });
      addToast({ variant: 'success', title: 'Order updated' });
    } catch (err) {
      setFulfillmentStatus(order.fulfillmentStatus);
      addToast({
        variant: 'error',
        title: 'Update failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  const canCancel = order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED';
  const canRefund =
    order.paymentStatus === 'PAID' || order.paymentStatus === 'PARTIALLY_REFUNDED';

  return (
    <AdminTr>
      <AdminTd>
        <div className="space-y-1">
          <p className="font-mono text-xs font-semibold text-brand-text">
            {order.orderNumber}
          </p>
          <p className="text-xs text-brand-muted">{shortDate(order.createdAt)}</p>
        </div>
      </AdminTd>

      <AdminTd>
        <div className="max-w-[220px] space-y-1">
          <p className="truncate font-medium text-brand-text">
            {order.customer.name ?? order.customer.email ?? 'Guest checkout'}
          </p>
          {order.customer.email && (
            <p className="truncate text-xs text-brand-muted">{order.customer.email}</p>
          )}
          {order.customer.phone && (
            <p className="text-xs text-brand-muted">{order.customer.phone}</p>
          )}
        </div>
      </AdminTd>

      <AdminTd>
        <div className="space-y-1">
          <p className="font-semibold text-brand-text">
            {money(order.amounts.totalCents, order.amounts.currency)}
          </p>
          <p className="text-xs text-brand-muted">
            {order.items.length} item{order.items.length === 1 ? '' : 's'}
          </p>
        </div>
      </AdminTd>

      <AdminTd><StatusBadge status={order.status} /></AdminTd>
      <AdminTd><StatusBadge status={order.paymentStatus} /></AdminTd>

      <AdminTd>
        <select
          className={selectCls}
          value={fulfillmentStatus}
          disabled={isPending}
          onChange={(event) => void changeFulfillment(event.target.value as FulfillmentStatus)}
        >
          {FULFILLMENT_OPTIONS.map((option) => (
            <option key={option} value={option}>{humanStatus(option)}</option>
          ))}
        </select>
      </AdminTd>

      <AdminTd><StatusBadge status={order.refundStatus} /></AdminTd>

      <AdminTd>
        <div className="max-w-[220px] space-y-1">
          {order.items.slice(0, 2).map((item) => (
            <p key={item.id} className="truncate text-xs text-brand-muted">
              {item.quantity} x {item.name}
            </p>
          ))}
          {order.items.length > 2 && (
            <p className="text-xs text-brand-muted">
              +{order.items.length - 2} more
            </p>
          )}
        </div>
      </AdminTd>

      <AdminTd className="text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={!canCancel}
            onClick={() => onCancel(order)}
            className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-brand-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canRefund}
            onClick={() => onRefund(order)}
            className="rounded-md border border-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Refund
          </button>
        </div>
      </AdminTd>
    </AdminTr>
  );
}

export function OrderTable({
  items,
  isLoading,
  total,
  page,
  pageSize,
  totalPages,
  onPage,
}: OrderTableProps) {
  const [cancelOrder, setCancelOrder] = useState<AdminOrder | null>(null);
  const [refundOrder, setRefundOrder] = useState<AdminOrder | null>(null);
  const { mutateAsync: cancelMutation, isPending: cancelling } = useCancelOrder();
  const { mutateAsync: refundMutation, isPending: refunding } = useRefundOrder();
  const { addToast } = useToastContext();

  async function confirmCancel() {
    if (!cancelOrder) return;
    try {
      await cancelMutation(cancelOrder.id);
      addToast({ variant: 'success', title: 'Order cancelled' });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Cancel failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setCancelOrder(null);
    }
  }

  async function confirmRefund() {
    if (!refundOrder) return;
    try {
      await refundMutation({
        id: refundOrder.id,
        input: { amountCents: refundOrder.amounts.totalCents, reason: 'requested_by_customer' },
      });
      addToast({ variant: 'success', title: 'Refund requested' });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Refund failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRefundOrder(null);
    }
  }

  if (isLoading) return <AdminTableSkeleton rows={8} cols={9} />;

  return (
    <>
      <ConfirmModal
        open={!!cancelOrder}
        title="Cancel order"
        message={`Cancel ${cancelOrder?.orderNumber ?? 'this order'} and release reserved inventory?`}
        confirmLabel={cancelling ? 'Cancelling...' : 'Cancel order'}
        destructive
        onConfirm={() => { void confirmCancel(); }}
        onCancel={() => setCancelOrder(null)}
      />
      <ConfirmModal
        open={!!refundOrder}
        title="Refund order"
        message={`Request a full Stripe refund for ${refundOrder?.orderNumber ?? 'this order'}?`}
        confirmLabel={refunding ? 'Requesting...' : 'Request refund'}
        destructive
        onConfirm={() => { void confirmRefund(); }}
        onCancel={() => setRefundOrder(null)}
      />

      <div className="overflow-hidden rounded-xl border border-white/10">
        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>Order</AdminTh>
              <AdminTh>Customer</AdminTh>
              <AdminTh>Total</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Payment</AdminTh>
              <AdminTh>Fulfillment</AdminTh>
              <AdminTh>Refund</AdminTh>
              <AdminTh>Items</AdminTh>
              <AdminTh className="text-right">Actions</AdminTh>
            </tr>
          </AdminThead>

          {items.length === 0 ? (
            <AdminTableEmpty message="No orders found" colSpan={9} />
          ) : (
            <AdminTbody>
              {items.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onCancel={setCancelOrder}
                  onRefund={setRefundOrder}
                />
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
