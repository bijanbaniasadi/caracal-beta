'use client';

import { useState } from 'react';

import { CaracalApiError } from '@/lib/api';
import { useQuoteRequest } from '@/hooks/mutations/use-quote-request';
import { useApiConfig } from '@/providers/api-provider';
import { FormField, fieldSetter, inputCls, textareaCls } from './form-field';
import { SuccessCard } from './success-card';

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  customerName: string;
  customerEmail: string;
  message: string;
  customerPhone: string;
  companyName: string;
  workshopName: string;
  vehicleDetails: string;
  requestedItems: string;
}

const INITIAL: FormState = {
  customerName: '',
  customerEmail: '',
  message: '',
  customerPhone: '',
  companyName: '',
  workshopName: '',
  vehicleDetails: '',
  requestedItems: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function QuoteRequestForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const { submitAsync, isPending, isSuccess, data, error, reset } = useQuoteRequest();
  const { isDev } = useApiConfig();

  // Derive field-level and form-level validation errors from CaracalApiError.
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
        description="We'll review your request and get back to you within 1–2 business days."
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
        try {
          await submitAsync({
            customerName: form.customerName,
            customerEmail: form.customerEmail,
            message: form.message,
            ...(form.customerPhone && { customerPhone: form.customerPhone }),
            ...(form.companyName && { companyName: form.companyName }),
            ...(form.workshopName && { workshopName: form.workshopName }),
            ...(form.vehicleDetails && { vehicleDetails: form.vehicleDetails }),
            ...(form.requestedItems && {
              requestedItems: form.requestedItems
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            }),
          });
        } catch {
          // onError in the hook handles the toast; error state updates automatically.
        }
      }}
    >
      {/* ── Required ──────────────────────────────────────────────────── */}
      <FormField label="Name" htmlFor="qr-name" required error={fe['customerName']?.[0]}>
        <input
          id="qr-name"
          type="text"
          value={form.customerName}
          onChange={set('customerName')}
          placeholder="Your full name"
          disabled={isPending}
          autoComplete="name"
          className={inputCls(!!fe['customerName']?.[0])}
        />
      </FormField>

      <FormField label="Email" htmlFor="qr-email" required error={fe['customerEmail']?.[0]}>
        <input
          id="qr-email"
          type="email"
          value={form.customerEmail}
          onChange={set('customerEmail')}
          placeholder="you@example.com"
          disabled={isPending}
          autoComplete="email"
          className={inputCls(!!fe['customerEmail']?.[0])}
        />
      </FormField>

      <FormField label="Message" htmlFor="qr-message" required error={fe['message']?.[0]}>
        <textarea
          id="qr-message"
          rows={5}
          value={form.message}
          onChange={set('message')}
          placeholder="Describe what you need — parts, services, or questions…"
          disabled={isPending}
          className={textareaCls(!!fe['message']?.[0])}
        />
      </FormField>

      {/* ── Optional ──────────────────────────────────────────────────── */}
      <div className="space-y-5 border-t border-slate-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Optional details
        </p>

        <FormField label="Phone" htmlFor="qr-phone" error={fe['customerPhone']?.[0]}>
          <input
            id="qr-phone"
            type="tel"
            value={form.customerPhone}
            onChange={set('customerPhone')}
            placeholder="+971 50 000 0000"
            disabled={isPending}
            autoComplete="tel"
            className={inputCls(!!fe['customerPhone']?.[0])}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Company" htmlFor="qr-company" error={fe['companyName']?.[0]}>
            <input
              id="qr-company"
              type="text"
              value={form.companyName}
              onChange={set('companyName')}
              placeholder="Company name"
              disabled={isPending}
              className={inputCls(!!fe['companyName']?.[0])}
            />
          </FormField>

          <FormField label="Workshop" htmlFor="qr-workshop" error={fe['workshopName']?.[0]}>
            <input
              id="qr-workshop"
              type="text"
              value={form.workshopName}
              onChange={set('workshopName')}
              placeholder="Workshop name"
              disabled={isPending}
              className={inputCls(!!fe['workshopName']?.[0])}
            />
          </FormField>
        </div>

        <FormField
          label="Vehicle details"
          htmlFor="qr-vehicle"
          error={fe['vehicleDetails']?.[0]}
          hint="Make, model, year, engine"
        >
          <input
            id="qr-vehicle"
            type="text"
            value={form.vehicleDetails}
            onChange={set('vehicleDetails')}
            placeholder="e.g. Toyota Land Cruiser 2022 V8"
            disabled={isPending}
            className={inputCls(!!fe['vehicleDetails']?.[0])}
          />
        </FormField>

        <FormField
          label="Requested items"
          htmlFor="qr-items"
          error={fe['requestedItems']?.[0]}
          hint="Comma-separated list of parts or services"
        >
          <input
            id="qr-items"
            type="text"
            value={form.requestedItems}
            onChange={set('requestedItems')}
            placeholder="KESS3 Master, WinOLS license, ECU file"
            disabled={isPending}
            className={inputCls(!!fe['requestedItems']?.[0])}
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
        {isPending ? 'Submitting…' : 'Submit Quote Request'}
      </button>
    </form>
  );
}
