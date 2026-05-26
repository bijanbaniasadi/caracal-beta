'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/admin/catalog/review', label: 'Review' },
  { href: '/admin/catalog/images', label: 'Images' },
  { href: '/admin/catalog/pricing', label: 'Pricing' },
  { href: '/admin/catalog/observability', label: 'Observability' },
  { href: '/admin/catalog/reconciliation', label: 'Reconciliation' },
] as const;

export function AdminCurationFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange">
            Layered catalog
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-brand-text">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">{description}</p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Catalog curation">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'rounded-md border px-3 py-2 text-xs font-semibold transition',
                  active
                    ? 'border-brand-orange bg-brand-orange/10 text-brand-orange'
                    : 'border-white/10 text-brand-muted hover:text-brand-text',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-amber-200'
        : tone === 'bad'
          ? 'text-red-200'
          : 'text-brand-text';

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      {message}
    </div>
  );
}

export function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-sm text-brand-muted">
      {message}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

export function centsLabel(value: string | number | null, currency = 'USD'): string {
  if (value === null) return 'Request price';
  const cents = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (!Number.isFinite(cents)) return 'Request price';
  return `${currency} ${new Intl.NumberFormat('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)}`;
}
