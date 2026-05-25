'use client';

import type {
  BinUploadStatus,
  FulfillmentStatus,
  IntakeStatus,
  OrderStatus,
  PaymentStatus,
} from '@/lib/api/account-types';

// ─── Shared base ──────────────────────────────────────────────────────────────

const BASE = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold font-technical tracking-wide uppercase';

function dot(color: string) {
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden="true" />;
}

// ─── Order status ─────────────────────────────────────────────────────────────

const ORDER_CFG: Record<OrderStatus, { label: string; color: string; dot: string }> = {
  PENDING_PAYMENT: { label: 'Pending payment', color: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30', dot: 'bg-yellow-400' },
  PAID:            { label: 'Paid',            color: 'bg-brand-green/15 text-brand-green border border-brand-green/30', dot: 'bg-brand-green' },
  FULFILLING:      { label: 'Fulfilling',      color: 'bg-blue-500/15 text-blue-300 border border-blue-500/30', dot: 'bg-blue-400' },
  FULFILLED:       { label: 'Fulfilled',       color: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', dot: 'bg-emerald-400' },
  CANCELLED:       { label: 'Cancelled',       color: 'bg-white/5 text-brand-muted border border-white/10', dot: 'bg-brand-muted' },
  PARTIALLY_REFUNDED: { label: 'Part refund',  color: 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30', dot: 'bg-brand-orange' },
  REFUNDED:        { label: 'Refunded',        color: 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30', dot: 'bg-brand-orange' },
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const cfg = ORDER_CFG[status] ?? ORDER_CFG.PENDING_PAYMENT;
  return (
    <span className={`${BASE} ${cfg.color}`}>
      {dot(cfg.dot)}
      {cfg.label}
    </span>
  );
}

// ─── Payment status ───────────────────────────────────────────────────────────

const PAYMENT_CFG: Record<PaymentStatus, { label: string; color: string; dot: string }> = {
  PENDING:              { label: 'Pending',   color: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30', dot: 'bg-yellow-400' },
  PAID:                 { label: 'Paid',      color: 'bg-brand-green/15 text-brand-green border border-brand-green/30', dot: 'bg-brand-green' },
  FAILED:               { label: 'Failed',    color: 'bg-red-500/15 text-red-400 border border-red-500/30', dot: 'bg-red-400' },
  CANCELLED:            { label: 'Cancelled', color: 'bg-white/5 text-brand-muted border border-white/10', dot: 'bg-brand-muted' },
  REFUND_PENDING:       { label: 'Refund pending', color: 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30', dot: 'bg-brand-orange' },
  PARTIALLY_REFUNDED:   { label: 'Part refund', color: 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30', dot: 'bg-brand-orange' },
  REFUNDED:             { label: 'Refunded',  color: 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30', dot: 'bg-brand-orange' },
};

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  const cfg = PAYMENT_CFG[status] ?? PAYMENT_CFG.PENDING;
  return (
    <span className={`${BASE} ${cfg.color}`}>
      {dot(cfg.dot)}
      {cfg.label}
    </span>
  );
}

// ─── Fulfillment status ───────────────────────────────────────────────────────

const FULFILLMENT_CFG: Record<FulfillmentStatus, { label: string; color: string; dot: string }> = {
  UNFULFILLED: { label: 'Unfulfilled', color: 'bg-white/5 text-brand-muted border border-white/10', dot: 'bg-brand-muted' },
  PROCESSING:  { label: 'Processing',  color: 'bg-blue-500/15 text-blue-300 border border-blue-500/30', dot: 'bg-blue-400' },
  SHIPPED:     { label: 'Shipped',     color: 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30', dot: 'bg-brand-orange' },
  DELIVERED:   { label: 'Delivered',   color: 'bg-brand-green/15 text-brand-green border border-brand-green/30', dot: 'bg-brand-green' },
  CANCELLED:   { label: 'Cancelled',   color: 'bg-white/5 text-brand-muted border border-white/10', dot: 'bg-brand-muted' },
};

export function FulfillmentStatusPill({ status }: { status: FulfillmentStatus }) {
  const cfg = FULFILLMENT_CFG[status] ?? FULFILLMENT_CFG.UNFULFILLED;
  return (
    <span className={`${BASE} ${cfg.color}`}>
      {dot(cfg.dot)}
      {cfg.label}
    </span>
  );
}

// ─── Inquiry status ───────────────────────────────────────────────────────────

const INTAKE_CFG: Record<IntakeStatus, { label: string; color: string; dot: string }> = {
  NEW:       { label: 'New',       color: 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30', dot: 'bg-brand-orange' },
  IN_REVIEW: { label: 'In review', color: 'bg-blue-500/15 text-blue-300 border border-blue-500/30', dot: 'bg-blue-400 animate-pulse' },
  RESPONDED: { label: 'Responded', color: 'bg-brand-green/15 text-brand-green border border-brand-green/30', dot: 'bg-brand-green' },
  CLOSED:    { label: 'Closed',    color: 'bg-white/5 text-brand-muted border border-white/10', dot: 'bg-brand-muted' },
  SPAM:      { label: 'Spam',      color: 'bg-red-500/15 text-red-400 border border-red-500/30', dot: 'bg-red-400' },
};

export function InquiryStatusPill({ status }: { status: IntakeStatus }) {
  const cfg = INTAKE_CFG[status] ?? INTAKE_CFG.NEW;
  return (
    <span className={`${BASE} ${cfg.color}`}>
      {dot(cfg.dot)}
      {cfg.label}
    </span>
  );
}

// ─── BIN upload status ────────────────────────────────────────────────────────

const UPLOAD_CFG: Record<BinUploadStatus, { label: string; color: string; dot: string }> = {
  RECEIVED:  { label: 'Received',  color: 'bg-blue-500/15 text-blue-300 border border-blue-500/30', dot: 'bg-blue-400' },
  VALIDATED: { label: 'Validated', color: 'bg-brand-green/15 text-brand-green border border-brand-green/30', dot: 'bg-brand-green' },
  REJECTED:  { label: 'Rejected',  color: 'bg-red-500/15 text-red-400 border border-red-500/30', dot: 'bg-red-400' },
  STORED:    { label: 'Stored',    color: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', dot: 'bg-emerald-400' },
};

export function UploadStatusPill({ status }: { status: BinUploadStatus }) {
  const cfg = UPLOAD_CFG[status] ?? UPLOAD_CFG.RECEIVED;
  return (
    <span className={`${BASE} ${cfg.color}`}>
      {dot(cfg.dot)}
      {cfg.label}
    </span>
  );
}
