import type { ReactNode } from 'react';
import Link from 'next/link';

interface LegalSection {
  title: string;
  body: ReactNode;
}

interface LegalPageProps {
  eyebrow: string;
  title: string;
  description: string;
  sections: LegalSection[];
}

export function LegalPage({ eyebrow, title, description, sections }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-brand-bg">
      <section className="border-b border-white/10 bg-brand-deep px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
            {eyebrow}
          </p>
          <h1 className="font-display text-3xl font-bold text-brand-text sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted sm:text-base">
            {description}
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-brand-muted">
            Last updated: 22 May 2026
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-5">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6"
            >
              <h2 className="font-display text-lg font-bold text-brand-text">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-6 text-brand-muted">
                {section.body}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-brand-orange/30 bg-brand-orange/10 p-5">
          <p className="text-sm font-semibold text-brand-text">
            Need help with an order or policy?
          </p>
          <p className="mt-2 text-sm leading-6 text-brand-muted">
            Contact us at{' '}
            <a
              className="text-brand-orange hover:underline"
              href="mailto:info@caracaltechmotors.com"
            >
              info@caracaltechmotors.com
            </a>{' '}
            or use the{' '}
            <Link className="text-brand-orange hover:underline" href="/contact">
              contact form
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
