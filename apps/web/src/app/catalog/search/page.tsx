import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProjectionCatalogBrowser } from '@/components/catalog-projection/projection-catalog-browser';
import {
  projectionParamsFromRecord,
  type ProjectionSearchParamRecord,
} from '@/lib/api/projection-catalog-params';
import { getInitialProjectedCatalogPage } from '@/lib/api/projection-catalog-ssr';

export const metadata: Metadata = {
  title: 'Search ECU Tools | Caracal Tech',
  description: 'Search ECU tools, tuning hardware, and workshop equipment.',
};

export const dynamic = 'force-dynamic';

export default async function CatalogSearchPage({
  searchParams,
}: {
  searchParams: Promise<ProjectionSearchParamRecord>;
}) {
  const initialParams = projectionParamsFromRecord(await searchParams);
  const initial = await getInitialProjectedCatalogPage(initialParams, true);

  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-white/[0.04]" />}>
      <ProjectionCatalogBrowser
        mode="search"
        title="Search catalog"
        subtitle="Search by product, manufacturer, category, or part number."
        initialParams={initialParams}
        initialPage={initial.page}
        initialError={initial.error}
      />
    </Suspense>
  );
}
