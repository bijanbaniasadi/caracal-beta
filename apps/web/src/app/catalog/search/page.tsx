import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProjectionCatalogBrowser } from '@/components/catalog-projection/projection-catalog-browser';

export const metadata: Metadata = {
  title: 'Catalog Search | Caracal Tech',
  description: 'Search projected catalog products through the Typesense products alias.',
};

export const dynamic = 'force-dynamic';

export default function CatalogSearchPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-white/[0.04]" />}>
      <ProjectionCatalogBrowser
        mode="search"
        title="Search catalog"
        subtitle="Instant search uses the public search API, which queries the Typesense products alias only."
      />
    </Suspense>
  );
}
