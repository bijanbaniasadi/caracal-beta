import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProjectionCatalogBrowser } from '@/components/catalog-projection/projection-catalog-browser';
import { getProjectedManufacturer } from '@/lib/api/projection-catalog-client';
import {
  projectionParamsFromRecord,
  type ProjectionSearchParamRecord,
} from '@/lib/api/projection-catalog-params';
import { getInitialProjectedCatalogPage } from '@/lib/api/projection-catalog-ssr';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ProjectionSearchParamRecord>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const manufacturer = await getProjectedManufacturer(slug);
    return {
      title: `${manufacturer.name} | Catalog | Caracal Tech`,
      description: `Projected catalog products from ${manufacturer.name}.`,
    };
  } catch {
    return { title: 'Catalog Manufacturer | Caracal Tech' };
  }
}

export default async function CatalogManufacturerPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const initialParams = projectionParamsFromRecord(await searchParams, { manufacturer: slug });
  const initial = await getInitialProjectedCatalogPage(initialParams);
  let title = slug.replace(/-/g, ' ');
  let subtitle = 'Projected products from this manufacturer.';

  try {
    const manufacturer = await getProjectedManufacturer(slug);
    title = manufacturer.name;
    subtitle = `${manufacturer.product_count} projected product${manufacturer.product_count === 1 ? '' : 's'} from ${manufacturer.name}.`;
  } catch {
    subtitle =
      'This manufacturer has no projected products yet or the projection API is unavailable.';
  }

  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-white/[0.04]" />}>
      <ProjectionCatalogBrowser
        mode="manufacturer"
        fixedManufacturer={slug}
        title={title}
        subtitle={subtitle}
        initialParams={initialParams}
        initialPage={initial.page}
        initialError={initial.error}
      />
    </Suspense>
  );
}
