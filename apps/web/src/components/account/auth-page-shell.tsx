import Link from 'next/link';
import type { ReactNode } from 'react';

interface AuthPageShellProps {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
}

const trustPoints = [
  ['Trade workflow', 'Company profile, technical support and checkout references stay together.'],
  ['Account recovery', 'Reset access without losing inquiry, quote or upload history.'],
  ['Dubai support', 'UAE fulfilment and workshop communication remain tied to your login.'],
];

export function AuthPageShell({ eyebrow, title, lead, children }: AuthPageShellProps) {
  return (
    <section className="bg-brand-bg">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8 lg:py-14">
        <div className="flex flex-col justify-center">
          <p className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
            {eyebrow}
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight text-brand-text sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-brand-muted">{lead}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {trustPoints.map(([label, description]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-brand-text">{label}</p>
                <p className="mt-2 text-sm leading-6 text-brand-muted">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-white/5"
            >
              Shop catalog
            </Link>
            <Link
              href="/contact"
              className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-white/5"
            >
              Contact support
            </Link>
          </div>
        </div>

        <div className="flex items-center">
          <div className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-6 shadow-brand-sm sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
