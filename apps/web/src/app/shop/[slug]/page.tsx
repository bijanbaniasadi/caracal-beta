import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getProductBySlug } from '@/lib/api/catalog-client';
import { ProductDetailContent } from '@/components/catalog/product-detail-content';

// ─── Metadata (runs server-side) ──────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const product = await getProductBySlug(slug);
    return {
      title: `${product.name} | Caracal Tech`,
      description: product.shortDescription ?? product.name,
      openGraph: {
        title: product.name,
        description: product.shortDescription ?? '',
        images: product.images
          .filter((img) => img.isPrimary)
          .map((img) => ({ url: img.url, alt: img.altText ?? product.name })),
      },
    };
  } catch {
    return {
      title: 'Product | Caracal Tech',
    };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Attempt a server-side prefetch to seed the client's React Query cache.
  // If the fetch fails (404, network error), the client component renders
  // its own loading → error state gracefully.
  let initialData: Awaited<ReturnType<typeof getProductBySlug>> | undefined;
  try {
    initialData = await getProductBySlug(slug);
  } catch {
    // Client will re-fetch; initialData remains undefined
  }

  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-slate-100" />}>
      <ProductDetailContent slug={slug} initialData={initialData} />
    </Suspense>
  );
}
