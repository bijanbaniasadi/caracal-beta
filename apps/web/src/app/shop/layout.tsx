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
    <div className="min-h-screen bg-white">
      {/* ── Shop header ─────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Shop
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Professional ECU tuning and diagnostic solutions
          </p>
        </div>
      </div>

      {/* ── Page body ───────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
