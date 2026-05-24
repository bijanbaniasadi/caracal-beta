'use client';

import { useState } from 'react';

import { CaracalApiError } from '@/lib/api';
import { useProductInquiry } from '@/hooks/mutations/use-product-inquiry';
import { useApiConfig } from '@/providers/api-provider';
import { FormField, fieldSetter, inputCls, textareaCls } from './form-field';
import { SuccessCard } from './success-card';

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  productName: string;
  customerName: string;
  customerEmail: string;
  message: string;
  productSku: string;
  productId: string;
  customerPhone: string;
  companyName: string;
  quantity: string; // stored as string; parsed to number before submit
}

const INITIAL: FormState = {
  productName: '',
  customerName: '',
  customerEmail: '',
  message: '',
  productSku: '',
  productId: '',
  customerPhone: '',
  companyName: '',
  quantity: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductInquiryForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const { submitAsync, isPending, isSuccess, data, error, reset } = useProductInquiry();
  const { isDev } = useApiConfig();

  const fe =
    error instanceof CaracalApiError
      ? (error.getFieldErrors()?.fieldErrors ?? {})
      : {};
  const formErrors =
    error instanceof CaracalApiError
      ? (error.getFieldErrors()?.formErrors ?? [])
      : [];

  const set = (key: keyof FormState) => fieldSetter<FormState>(setForm, key);

  const handleReset = () => {
    reset();
    setForm(INITIAL);
  };

  // ── Success state ────────────────────────────────────────────────────────
  if (isSuccess && data) {
    return (
      <SuccessCard
        referenceCode={data.referenceCode}
        description="Our team will follow up with pricing and availability."
        onReset={handleReset}
      />
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const qty = parseInt(form.quantity, 10);
        try {
          await submitAsync({
            productName: form.productName,
            customerName: form.customerName,
            customerEmail: form.customerEmail,
            message: form.message,
            ...(form.productSku && { productSku: form.productSku }),
            ...(form.productId && { productId: form.productId }),
            ...(form.customerPhone && { customerPhone: form.customerPhone }),
            ...(form.companyName && { companyName: form.companyName }),
            ...(form.quantity && !isNaN(qty) && { quantity: qty }),
          });
        } catch {
          // Hook's onError fires the toast; error state updates automatically.
        }
      }}
    >
      {/* ── Required ──────────────────────────────────────────────────── */}
      <FormField
        label="Product name"
        htmlFor="pi-product"
        required
        error={fe['productName']?.[0]}
      >
        <input
          id="pi-product"
          type="text"
          value={form.productName}
          onChange={set('productName')}
          placeholder="e.g. KESS3 Master, AutoTuner"
          disabled={isPending}
          className={inputCls(!!fe['productName']?.[0])}
        />
      </FormField>

      <FormField label="Your name" htmlFor="pi-name" required error={fe['customerName']?.[0]}>
        <input
          id="pi-name"
          type="text"
          value={form.customerName}
          onChange={set('customerName')}
          placeholder="Full name"
          disabled={isPending}
          autoComplete="name"
          className={inputCls(!!fe['customerName']?.[0])}
        />
      </FormField>

      <FormField label="Email" htmlFor="pi-email" required error={fe['customerEmail']?.[0]}>
        <input
          id="pi-email"
          type="email"
          value={form.customerEmail}
          onChange={set('customerEmail')}
          placeholder="you@example.com"
          disabled={isPending}
          autoComplete="email"
          className={inputCls(!!fe['customerEmail']?.[0])}
        />
      </FormField>

      <FormField label="Message" htmlFor="pi-message" required error={fe['message']?.[0]}>
        <textarea
          id="pi-message"
          rows={4}
          value={form.message}
          onChange={set('message')}
          placeholder="Describe your intended use, region, or any technical requirements…"
          disabled={isPending}
          className={textareaCls(!!fe['message']?.[0])}
        />
      </FormField>

      {/* ── Optional ──────────────────────────────────────────────────── */}
      <div className="space-y-5 border-t border-slate-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Optional details
        </p>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Product SKU"
            htmlFor="pi-sku"
            error={fe['productSku']?.[0]}
            hint="e.g. kess3-master"
          >
            <input
              id="pi-sku"
              type="text"
              value={form.productSku}
              onChange={set('productSku')}
              placeholder="kess3-master"
              disabled={isPending}
              className={inputCls(!!fe['productSku']?.[0])}
            />
          </FormField>

          <FormField
            label="Quantity"
            htmlFor="pi-qty"
            error={fe['quantity']?.[0]}
          >
            <input
              id="pi-qty"
              type="number"
              min={1}
              max={100000}
              value={form.quantity}
              onChange={set('quantity')}
              placeholder="1"
              disabled={isPending}
              className={inputCls(!!fe['quantity']?.[0])}
            />
          </FormField>
        </div>

        <FormField label="Phone" htmlFor="pi-phone" error={fe['customerPhone']?.[0]}>
          <input
            id="pi-phone"
            type="tel"
            value={form.customerPhone}
            onChange={set('customerPhone')}
            placeholder="+971 50 000 0000"
            disabled={isPending}
            autoComplete="tel"
            className={inputCls(!!fe['customerPhone']?.[0])}
          />
        </FormField>

        <FormField label="Company" htmlFor="pi-company" error={fe['companyName']?.[0]}>
          <input
            id="pi-company"
            type="text"
            value={form.companyName}
            onChange={set('companyName')}
            placeholder="Company / workshop name"
            disabled={isPending}
            className={inputCls(!!fe['companyName']?.[0])}
          />
        </FormField>
      </div>

      {/* ── Form-level errors ──────────────────────────────────────────── */}
      {formErrors.length > 0 && (
        <div className="space-y-1 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          {formErrors.map((msg, i) => (
            <p key={i} className="text-sm text-red-700">
              {msg}
            </p>
          ))}
        </div>
      )}

      {/* ── Dev: request-id ────────────────────────────────────────────── */}
      {isDev && error instanceof CaracalApiError && error.requestId && (
        <p className="font-mono text-xs text-slate-400">
          req&nbsp;{error.requestId}
        </p>
      )}

      {/* ── Submit ─────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isPending}
        className={[
          'w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white',
          'transition-colors focus:outline-none focus:ring-2',
          'focus:ring-slate-500 focus:ring-offset-2',
          isPending
            ? 'cursor-not-allowed bg-slate-400'
            : 'bg-slate-900 hover:bg-slate-700',
        ].join(' ')}
      >
        {isPending ? 'Submitting…' : 'Submit Inquiry'}
      </button>
    </form>
  );
}
