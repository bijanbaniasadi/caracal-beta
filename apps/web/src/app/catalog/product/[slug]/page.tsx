import Link from 'next/link';
import type { Metadata } from 'next';
import { ProjectionProductDetail } from '@/components/catalog-projection/projection-product-detail';
import { getProjectedProduct } from '@/lib/api/projection-catalog-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const product = await getProjectedProduct(slug);
    return {
      title: `${product.name} | Catalog | Caracal Tech`,
      description: product.shortDescription ?? product.name,
      openGraph: {
        title: product.name,
        description: product.shortDescription ?? '',
        images: product.primaryImage?.url
          ? [{ url: product.primaryImage.url, alt: product.primaryImage.altText ?? product.name }]
          : [],
      },
    };
  } catch {
    return { title: 'Catalog Product | Caracal Tech' };
  }
}

export default async function CatalogProductPage({ params }: PageProps) {
  const { slug } = await params;

  try {
    const product = await getProjectedProduct(slug);
    return <ProjectionProductDetail product={product} />;
  } catch {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <p className="text-sm font-semibold text-brand-text">Projected product not found</p>
        <p className="mt-2 text-sm text-brand-muted">
          The product may be unpublished, not projected yet, or temporarily unavailable.
        </p>
        <Link
          href="/catalog"
          className="mt-5 inline-flex rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-brand-text hover:border-brand-orange"
        >
          Back to catalog preview
        </Link>
      </div>
    );
  }
}
