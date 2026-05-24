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
    <Suspense fallback={<ShopFallback />}>
      <ShopContent />
    </Suspense>
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
