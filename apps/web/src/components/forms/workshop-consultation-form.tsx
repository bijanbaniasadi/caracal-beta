'use client';

import { useState } from 'react';

import { CaracalApiError } from '@/lib/api';
import { useWorkshopConsultation } from '@/hooks/mutations/use-workshop-consultation';
import { useApiConfig } from '@/providers/api-provider';
import { FormField, fieldSetter, inputCls, textareaCls } from './form-field';
import { SuccessCard } from './success-card';

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  workshopName: string;
  contactName: string;
  contactEmail: string;
  message: string;
  contactPhone: string;
  location: string;
  monthlyVolume: string; // stored as string; parsed to number before submit
  serviceInterests: string; // comma-separated
  preferredTimeline: string;
}

const INITIAL: FormState = {
  workshopName: '',
  contactName: '',
  contactEmail: '',
  message: '',
  contactPhone: '',
  location: '',
  monthlyVolume: '',
  serviceInterests: '',
  preferredTimeline: '',
};

const TIMELINE_OPTIONS = [
  '',
  'Within 1 month',
  'Within 3 months',
  'Within 6 months',
  '6+ months',
];

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkshopConsultationForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const { submitAsync, isPending, isSuccess, data, error, reset } =
    useWorkshopConsultation();
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
        description="A Caracal specialist will be in touch to schedule your consultation."
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
        const vol = parseInt(form.monthlyVolume, 10);
        try {
          await submitAsync({
            workshopName: form.workshopName,
            contactName: form.contactName,
            contactEmail: form.contactEmail,
            message: form.message,
            ...(form.contactPhone && { contactPhone: form.contactPhone }),
            ...(form.location && { location: form.location }),
            ...(form.monthlyVolume && !isNaN(vol) && { monthlyVolume: vol }),
            ...(form.serviceInterests && {
              serviceInterests: form.serviceInterests
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            }),
            ...(form.preferredTimeline && {
              preferredTimeline: form.preferredTimeline,
            }),
          });
        } catch {
          // Hook's onError fires the toast; error state updates automatically.
        }
      }}
    >
      {/* ── Required ──────────────────────────────────────────────────── */}
      <FormField
        label="Workshop name"
        htmlFor="wc-workshop"
        required
        error={fe['workshopName']?.[0]}
      >
        <input
          id="wc-workshop"
          type="text"
          value={form.workshopName}
          onChange={set('workshopName')}
          placeholder="Your workshop name"
          disabled={isPending}
          className={inputCls(!!fe['workshopName']?.[0])}
        />
      </FormField>

      <FormField
        label="Contact name"
        htmlFor="wc-contact"
        required
        error={fe['contactName']?.[0]}
      >
        <input
          id="wc-contact"
          type="text"
          value={form.contactName}
          onChange={set('contactName')}
          placeholder="Full name"
          disabled={isPending}
          autoComplete="name"
          className={inputCls(!!fe['contactName']?.[0])}
        />
      </FormField>

      <FormField
        label="Email"
        htmlFor="wc-email"
        required
        error={fe['contactEmail']?.[0]}
      >
        <input
          id="wc-email"
          type="email"
          value={form.contactEmail}
          onChange={set('contactEmail')}
          placeholder="you@workshop.com"
          disabled={isPending}
          autoComplete="email"
          className={inputCls(!!fe['contactEmail']?.[0])}
        />
      </FormField>

      <FormField
        label="Message"
        htmlFor="wc-message"
        required
        error={fe['message']?.[0]}
      >
        <textarea
          id="wc-message"
          rows={4}
          value={form.message}
          onChange={set('message')}
          placeholder="Tell us about your workshop, current tooling, and what you're looking to achieve…"
          disabled={isPending}
          className={textareaCls(!!fe['message']?.[0])}
        />
      </FormField>

      {/* ── Optional ──────────────────────────────────────────────────── */}
      <div className="space-y-5 border-t border-slate-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Optional details
        </p>

        <FormField label="Phone" htmlFor="wc-phone" error={fe['contactPhone']?.[0]}>
          <input
            id="wc-phone"
            type="tel"
            value={form.contactPhone}
            onChange={set('contactPhone')}
            placeholder="+971 50 000 0000"
            disabled={isPending}
            autoComplete="tel"
            className={inputCls(!!fe['contactPhone']?.[0])}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Location"
            htmlFor="wc-location"
            error={fe['location']?.[0]}
            hint="City or emirate"
          >
            <input
              id="wc-location"
              type="text"
              value={form.location}
              onChange={set('location')}
              placeholder="Dubai, Abu Dhabi…"
              disabled={isPending}
              className={inputCls(!!fe['location']?.[0])}
            />
          </FormField>

          <FormField
            label="Monthly volume"
            htmlFor="wc-volume"
            error={fe['monthlyVolume']?.[0]}
            hint="ECU jobs per month"
          >
            <input
              id="wc-volume"
              type="number"
              min={0}
              value={form.monthlyVolume}
              onChange={set('monthlyVolume')}
              placeholder="50"
              disabled={isPending}
              className={inputCls(!!fe['monthlyVolume']?.[0])}
            />
          </FormField>
        </div>

        <FormField
          label="Service interests"
          htmlFor="wc-services"
          error={fe['serviceInterests']?.[0]}
          hint="Comma-separated — e.g. Remapping, DPF, EGR, Stage 1"
        >
          <input
            id="wc-services"
            type="text"
            value={form.serviceInterests}
            onChange={set('serviceInterests')}
            placeholder="Remapping, DPF removal, Stage 1"
            disabled={isPending}
            className={inputCls(!!fe['serviceInterests']?.[0])}
          />
        </FormField>

        <FormField
          label="Preferred timeline"
          htmlFor="wc-timeline"
          error={fe['preferredTimeline']?.[0]}
        >
          <select
            id="wc-timeline"
            value={form.preferredTimeline}
            onChange={set('preferredTimeline')}
            disabled={isPending}
            className={inputCls(!!fe['preferredTimeline']?.[0])}
          >
            {TIMELINE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt || 'Select a timeline…'}
              </option>
            ))}
          </select>
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
        {isPending ? 'Submitting…' : 'Request Consultation'}
      </button>
    </form>
  );
}
