import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProjectionCatalogBrowser } from '@/components/catalog-projection/projection-catalog-browser';
import { getProjectedCategory } from '@/lib/api/projection-catalog-client';

interface PageProps {
  params: Promise<{ slug: string }>;
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

export default async function CatalogCategoryPage({ params }: PageProps) {
  const { slug } = await params;
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
      />
    </Suspense>
  );
}
