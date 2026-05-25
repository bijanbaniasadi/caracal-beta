'use client';

import { useState } from 'react';
import { OrderTable } from '@/components/admin/orders/order-table';
import { useAdminOrders } from '@/hooks/queries/use-admin-orders';
import type { OrderStatus, PaymentStatus } from '@/lib/api/admin-types';

const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus | ''; label: string }> = [
  { value: '', label: 'All orders' },
  { value: 'PENDING_PAYMENT', label: 'Pending payment' },
  { value: 'PAID', label: 'Paid' },
  { value: 'FULFILLING', label: 'Fulfilling' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partially refunded' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const PAYMENT_STATUS_OPTIONS: Array<{ value: PaymentStatus | ''; label: string }> = [
  { value: '', label: 'All payment states' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUND_PENDING', label: 'Refund pending' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partially refunded' },
  { value: 'REFUNDED', label: 'Refunded' },
];

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | ''>('');
  const pageSize = 20;

  const { data, isLoading } = useAdminOrders({
    page,
    pageSize,
    search: search || undefined,
    status: status || undefined,
    paymentStatus: paymentStatus || undefined,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search order, customer, SKU, Stripe ID..."
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          className="w-72 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50"
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as OrderStatus | '');
            setPaymentStatus('');
            setPage(1);
          }}
          className="rounded-lg border border-white/10 bg-[#0f1923] px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-orange/50"
        >
          {ORDER_STATUS_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={paymentStatus}
          onChange={(event) => {
            setPaymentStatus(event.target.value as PaymentStatus | '');
            setStatus('');
            setPage(1);
          }}
          className="rounded-lg border border-white/10 bg-[#0f1923] px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-orange/50"
        >
          {PAYMENT_STATUS_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="ml-auto text-sm text-brand-muted">
          {isLoading ? 'Loading...' : `${data?.total ?? 0} orders`}
        </p>
      </div>

      <OrderTable
        items={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? pageSize}
        totalPages={data?.totalPages ?? 0}
        onPage={setPage}
      />
    </div>
  );
}
