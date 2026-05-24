import { Suspense } from 'react';
import { ShopContent } from '@/components/catalog/shop-content';

export const metadata = {
  title: 'Shop | Caracal Tech',
  description:
    'Browse our full range of ECU tuning tools, diagnostic equipment, and workshop solutions.',
};

// ShopContent calls useSearchParams() — must be wrapped in Suspense per Next.js 15
export default function ShopPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-white/10 bg-white/5 p-5">
        <div className="grid gap-4 text-sm text-brand-muted sm:grid-cols-3">
          <div>
            <p className="font-semibold text-brand-text">UAE stock and sourcing</p>
            <p className="mt-1 leading-6">
              Dubai-based fulfilment for in-stock tools and verified supplier orders.
            </p>
          </div>
          <div>
            <p className="font-semibold text-brand-text">Secure payment options</p>
            <p className="mt-1 leading-6">
              Card, invoice, and bank-transfer workflows are confirmed during checkout or quote.
            </p>
          </div>
          <div>
            <p className="font-semibold text-brand-text">Workshop compatibility help</p>
            <p className="mt-1 leading-6">
              Ask before buying if you need protocol, ECU, or tool coverage confirmation.
            </p>
          </div>
        </div>
      </section>

      <Suspense fallback={<ShopFallback />}>
        <ShopContent />
      </Suspense>
    </div>
  );
}

function ShopFallback() {
  return (
    <div className="space-y-6">
      {/* Search + sort skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="h-10 flex-1 animate-pulse rounded-md bg-slate-100" />
        <div className="h-10 w-44 animate-pulse rounded-md bg-slate-100" />
      </div>
      {/* Category pills skeleton */}
      <div className="flex gap-2">
        {[60, 80, 70, 90, 65].map((w, i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded-full bg-slate-100"
            style={{ width: `${w}px` }}
          />
        ))}
      </div>
      {/* Grid skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-slate-200">
            <div className="aspect-square animate-pulse bg-slate-100" />
            <div className="space-y-2 p-3">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
