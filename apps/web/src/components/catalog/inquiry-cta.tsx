'use client';

import { useState } from 'react';

import { CaracalApiError } from '@/lib/api';
import { useProductInquiry } from '@/hooks/mutations/use-product-inquiry';
import { useApiConfig } from '@/providers/api-provider';
import { FormField, fieldSetter, inputCls, textareaCls } from '@/components/forms/form-field';
import { SuccessCard } from '@/components/forms/success-card';
import type { ProductInquiryMeta } from '@/lib/api/catalog-types';

// ─── Mini inquiry form state ──────────────────────────────────────────────────

interface FormState {
  customerName: string;
  customerEmail: string;
  message: string;
  customerPhone: string;
}

const INITIAL: FormState = {
  customerName: '',
  customerEmail: '',
  message: '',
  customerPhone: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface InquiryCtaProps {
  inquiry: ProductInquiryMeta;
}

export function InquiryCta({ inquiry }: InquiryCtaProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL);
  const { submitAsync, isPending, isSuccess, data, error, reset } =
    useProductInquiry();
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

  // ── Success ──────────────────────────────────────────────────────────────
  if (isSuccess && data) {
    return (
      <SuccessCard
        referenceCode={data.referenceCode}
        description="Our team will follow up with pricing and availability."
        onReset={() => { handleReset(); setOpen(false); }}
      />
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      {/* CTA header / toggle */}
      <div className="p-4">
        <p className="text-sm text-slate-600">
          Interested in{' '}
          <span className="font-medium text-slate-900">{inquiry.productName}</span>?
          Get pricing and availability for your region.
        </p>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={[
            'mt-3 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white',
            'bg-slate-900 hover:bg-slate-700 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2',
          ].join(' ')}
        >
          {open ? 'Cancel' : 'Enquire Now'}
        </button>
      </div>

      {/* Collapsible form */}
      {open && (
        <div className="border-t border-slate-200 p-4">
          <form
            noValidate
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await submitAsync({
                  productName: inquiry.productName,
                  productId: inquiry.productId,
                  ...(inquiry.productSku && { productSku: inquiry.productSku }),
                  customerName: form.customerName,
                  customerEmail: form.customerEmail,
                  message: form.message,
                  ...(form.customerPhone && { customerPhone: form.customerPhone }),
                });
              } catch {
                // Toast is handled by the hook's onError
              }
            }}
          >
            <FormField
              label="Name"
              htmlFor="iq-name"
              required
              error={fe['customerName']?.[0]}
            >
              <input
                id="iq-name"
                type="text"
                value={form.customerName}
                onChange={set('customerName')}
                placeholder="Your full name"
                disabled={isPending}
                autoComplete="name"
                className={inputCls(!!fe['customerName']?.[0])}
              />
            </FormField>

            <FormField
              label="Email"
              htmlFor="iq-email"
              required
              error={fe['customerEmail']?.[0]}
            >
              <input
                id="iq-email"
                type="email"
                value={form.customerEmail}
                onChange={set('customerEmail')}
                placeholder="you@example.com"
                disabled={isPending}
                autoComplete="email"
                className={inputCls(!!fe['customerEmail']?.[0])}
              />
            </FormField>

            <FormField
              label="Message"
              htmlFor="iq-message"
              required
              error={fe['message']?.[0]}
            >
              <textarea
                id="iq-message"
                rows={3}
                value={form.message}
                onChange={set('message')}
                placeholder="Tell us your region, intended use, or any questions…"
                disabled={isPending}
                className={textareaCls(!!fe['message']?.[0])}
              />
            </FormField>

            <FormField
              label="Phone"
              htmlFor="iq-phone"
              error={fe['customerPhone']?.[0]}
            >
              <input
                id="iq-phone"
                type="tel"
                value={form.customerPhone}
                onChange={set('customerPhone')}
                placeholder="+971 50 000 0000"
                disabled={isPending}
                autoComplete="tel"
                className={inputCls(!!fe['customerPhone']?.[0])}
              />
            </FormField>

            {/* Form-level errors */}
            {formErrors.length > 0 && (
              <div className="space-y-1 rounded-md border border-red-200 bg-red-50 px-4 py-3">
                {formErrors.map((msg, i) => (
                  <p key={i} className="text-sm text-red-700">
                    {msg}
                  </p>
                ))}
              </div>
            )}

            {isDev && error instanceof CaracalApiError && error.requestId && (
              <p className="font-mono text-xs text-slate-400">
                req&nbsp;{error.requestId}
              </p>
            )}

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
              {isPending ? 'Submitting…' : 'Send Enquiry'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
