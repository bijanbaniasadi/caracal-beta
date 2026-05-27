import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProjectionCatalogBrowser } from '@/components/catalog-projection/projection-catalog-browser';
import {
  projectionParamsFromRecord,
  type ProjectionSearchParamRecord,
} from '@/lib/api/projection-catalog-params';
import { getInitialProjectedCatalogPage } from '@/lib/api/projection-catalog-ssr';

export const metadata: Metadata = {
  title: 'ECU Tools Catalog | Caracal Tech',
  description:
    'Browse curated ECU programming tools and workshop equipment.',
};

export const dynamic = 'force-dynamic';

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<ProjectionSearchParamRecord>;
}) {
  const initialParams = projectionParamsFromRecord(await searchParams);
  const initial = await getInitialProjectedCatalogPage(initialParams);

  return (
    <Suspense fallback={<CatalogFallback />}>
      <ProjectionCatalogBrowser
        mode="home"
        title="ECU Tools Catalog"
        subtitle="Curated ECU tools, tuning hardware, and workshop equipment for UAE professionals."
        initialParams={initialParams}
        initialPage={initial.page}
        initialError={initial.error}
      />
    </Suspense>
  );
}

function CatalogFallback() {
  return (
    <div className="space-y-6">
      <div className="h-24 animate-pulse rounded-lg bg-white/[0.04]" />
      <div className="h-11 animate-pulse rounded-md bg-white/[0.04]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-72 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
          />
        ))}
      </div>
    </div>
  );
}
