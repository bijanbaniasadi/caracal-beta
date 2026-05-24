'use client';

import { useState } from 'react';
import { QuoteRequestForm } from '@/components/forms/quote-request-form';
import { ProductInquiryForm } from '@/components/forms/product-inquiry-form';
import { WorkshopConsultationForm } from '@/components/forms/workshop-consultation-form';
import { BinUploadForm } from '@/components/forms/bin-upload-form';

type Tab = 'quote' | 'inquiry' | 'workshop' | 'upload';

const TABS: { id: Tab; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'quote',
    label: 'Quote Request',
    description: 'Request pricing for tools, parts, file services, or workshop support.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    id: 'inquiry',
    label: 'Product Inquiry',
    description: 'Ask about a specific product — availability, specs, or compatibility.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    id: 'workshop',
    label: 'Workshop Consultation',
    description: 'Schedule a technical consultation for your workshop or fleet operation.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    id: 'upload',
    label: 'BIN Upload',
    description: 'Submit an ECU binary file for processing, analysis, or correction.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
  },
];

export default function ContactPage() {
  const [active, setActive] = useState<Tab>('quote');
  const activeTab = TABS.find((t) => t.id === active)!;

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Page header */}
      <div className="border-b border-white/10 bg-brand-deep px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-2 font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
            Get in touch
          </p>
          <h1 className="font-display text-3xl font-bold text-brand-text sm:text-4xl">
            Contact &amp; Requests
          </h1>
          <p className="mt-3 max-w-xl text-brand-muted">
            Submit a quote request, ask about a product, book a workshop consultation, or upload an
            ECU file. All submissions are tracked and responded to within 1–2 business days.
          </p>

          {/* Quick contact row */}
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-brand-muted">
            <a href="tel:+971585796760" className="flex items-center gap-2 hover:text-brand-text transition-colors">
              <span className="text-brand-orange">📞</span> +971 585 796 760
            </a>
            <a href="mailto:info@caracaltechmotors.com" className="flex items-center gap-2 hover:text-brand-text transition-colors">
              <span className="text-brand-orange">✉</span> info@caracaltechmotors.com
            </a>
            <a href="https://wa.me/971585796760" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-brand-text transition-colors">
              <span className="text-brand-green">💬</span> WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Tab selector */}
        <div
          role="tablist"
          aria-label="Request type"
          className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4"
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
                'flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center text-xs font-semibold transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange',
                active === tab.id
                  ? 'border-brand-orange/50 bg-brand-orange/10 text-brand-orange'
                  : 'border-white/10 bg-white/5 text-brand-muted hover:border-white/20 hover:text-brand-text',
              ].join(' ')}
            >
              <span className={active === tab.id ? 'text-brand-orange' : 'text-brand-muted'}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active tab description */}
        <p className="mb-6 text-sm text-brand-muted">{activeTab.description}</p>

        {/* Form panel */}
        <div
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-${active}`}
          className="rounded-xl border border-white/10 bg-white/5 px-6 py-7"
        >
          {/* Override form field colours inside the dark panel */}
          <style>{`
            .contact-panel input,
            .contact-panel textarea,
            .contact-panel select {
              background: rgba(255,255,255,0.06) !important;
              border-color: rgba(255,255,255,0.15) !important;
              color: #ecf2ff !important;
            }
            .contact-panel input::placeholder,
            .contact-panel textarea::placeholder {
              color: #9aa8bf !important;
            }
            .contact-panel label { color: #ecf2ff !important; }
            .contact-panel .text-slate-700 { color: #ecf2ff !important; }
            .contact-panel .text-slate-400 { color: #9aa8bf !important; }
            .contact-panel .text-slate-500 { color: #9aa8bf !important; }
            .contact-panel .border-slate-100 { border-color: rgba(255,255,255,0.08) !important; }
          `}</style>
          <div className="contact-panel">
            {active === 'quote' && <QuoteRequestForm />}
            {active === 'inquiry' && <ProductInquiryForm />}
            {active === 'workshop' && <WorkshopConsultationForm />}
            {active === 'upload' && <BinUploadForm />}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-brand-muted">
          Fields marked <span className="text-red-400">*</span> are required.
          Data is handled in accordance with our{' '}
          <a href="/privacy" className="underline hover:text-brand-text">privacy policy</a>.
        </p>
      </div>
    </div>
  );
}
