import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProjectionCatalogBrowser } from '@/components/catalog-projection/projection-catalog-browser';
import { getProjectedCategory } from '@/lib/api/projection-catalog-client';
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
    const category = await getProjectedCategory(slug);
    return {
      title: `${category.name} | Catalog | Caracal Tech`,
      description: `Projected catalog products in ${category.name}.`,
    };
  } catch {
    return { title: 'Catalog Category | Caracal Tech' };
  }
}

export default async function CatalogCategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const initialParams = projectionParamsFromRecord(await searchParams, { category: slug });
  const initial = await getInitialProjectedCatalogPage(initialParams);
  let title = slug.replace(/-/g, ' ');
  let subtitle = 'Projected products in this category.';

  try {
    const category = await getProjectedCategory(slug);
    title = category.name;
    subtitle = `${category.product_count} projected product${category.product_count === 1 ? '' : 's'} in ${category.name}.`;
  } catch {
    subtitle = 'This category has no projected products yet or the projection API is unavailable.';
  }

  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-white/[0.04]" />}>
      <ProjectionCatalogBrowser
        mode="category"
        fixedCategory={slug}
        title={title}
        subtitle={subtitle}
        initialParams={initialParams}
        initialPage={initial.page}
        initialError={initial.error}
      />
    </Suspense>
  );
}
