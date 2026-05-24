'use client';

import { useState } from 'react';

import { BinUploadForm } from '@/components/forms/bin-upload-form';
import { ProductInquiryForm } from '@/components/forms/product-inquiry-form';
import { QuoteRequestForm } from '@/components/forms/quote-request-form';
import { WorkshopConsultationForm } from '@/components/forms/workshop-consultation-form';

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = 'quote' | 'inquiry' | 'workshop' | 'upload';

const TABS: { id: Tab; label: string; description: string }[] = [
  {
    id: 'quote',
    label: 'Quote Request',
    description: 'Request pricing for tools, parts, or services.',
  },
  {
    id: 'inquiry',
    label: 'Product Inquiry',
    description: 'Ask about a specific product — availability, specs, or compatibility.',
  },
  {
    id: 'workshop',
    label: 'Workshop Lead',
    description: 'Schedule a consultation for your workshop.',
  },
  {
    id: 'upload',
    label: 'BIN Upload',
    description: 'Submit an ECU bin file for processing.',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [active, setActive] = useState<Tab>('quote');

  const activeTab = TABS.find((t) => t.id === active) ?? TABS[0];

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-16">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Caracal Tech Motors — Beta
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Intake Portal
        </h1>
        <p className="mt-2 text-slate-600">
          Submit requests, inquiries, workshop leads, or ECU bin files.
          All submissions are tracked and responded to within 1–2 business days.
        </p>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Form type"
        className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActive(tab.id)}
            className={[
              'flex-1 rounded-md px-2 py-2 text-xs font-semibold transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500',
              active === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Active panel description ─────────────────────────────────────── */}
      <p className="mb-6 text-sm text-slate-500">{activeTab.description}</p>

      {/* ── Form panels ──────────────────────────────────────────────────── */}
      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="rounded-lg border border-slate-200 bg-white px-6 py-7 shadow-sm"
      >
        {active === 'quote' && <QuoteRequestForm />}
        {active === 'inquiry' && <ProductInquiryForm />}
        {active === 'workshop' && <WorkshopConsultationForm />}
        {active === 'upload' && <BinUploadForm />}
      </div>

      {/* ── Footer note ──────────────────────────────────────────────────── */}
      <p className="mt-6 text-center text-xs text-slate-400">
        Fields marked <span className="text-red-500">*</span> are required.
        All data is handled in accordance with our privacy policy.
      </p>
    </main>
  );
}
