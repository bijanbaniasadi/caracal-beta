import type { ReactNode } from 'react';

export const metadata = {
  title: 'Shop | Caracal Tech',
  description:
    'ECU tuning tools, diagnostic equipment, and workshop solutions from Caracal Tech.',
};

interface ShopLayoutProps {
  children: ReactNode;
}

export default function ShopLayout({ children }: ShopLayoutProps) {
  return (
    <div className="min-h-screen bg-brand-bg">
      {/* ── Shop header ─────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-brand-deep px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-1 font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange">
            Catalog
          </p>
          <h1 className="font-display text-2xl font-bold text-brand-text sm:text-3xl">
            Shop
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            Professional ECU tuning tools and diagnostic solutions
          </p>
        </div>
      </div>

      {/* ── Page body ───────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
