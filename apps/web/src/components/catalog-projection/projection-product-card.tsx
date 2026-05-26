import Link from 'next/link';
import type {
  ProjectionProduct,
  ProjectionSearchProduct,
} from '@/lib/api/projection-catalog-types';
import { imageLabel, priceLabel, productImageUrl } from './projection-utils';

export function ProjectionProductCard({
  product,
}: {
  product: ProjectionProduct | ProjectionSearchProduct;
}) {
  const imageUrl = productImageUrl(product);

  return (
    <article className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
      <Link href={`/catalog/product/${product.slug}`} className="block">
        <div className="aspect-[4/3] bg-[#111b24]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={imageLabel(product)}
              className="h-full w-full object-contain p-4"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-brand-muted">
              Projection image pending
            </div>
          )}
        </div>
      </Link>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-brand-orange">
          <Link href={`/catalog/manufacturer/${product.manufacturer.slug}`}>
            {product.manufacturer.name}
          </Link>
          <span className="text-brand-muted">/</span>
          <Link href={`/catalog/category/${product.category.slug}`}>{product.category.name}</Link>
        </div>
        <div className="space-y-1">
          <Link
            href={`/catalog/product/${product.slug}`}
            className="line-clamp-2 text-sm font-semibold leading-5 text-brand-text hover:text-brand-orange"
          >
            {product.name}
          </Link>
          {product.shortDescription && (
            <p className="line-clamp-2 text-xs leading-5 text-brand-muted">
              {product.shortDescription}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-brand-text">{priceLabel(product)}</span>
          <span
            className={[
              'rounded-full px-2 py-1 text-[11px] font-semibold',
              product.inStock
                ? 'bg-emerald-500/10 text-emerald-300'
                : 'bg-white/5 text-brand-muted',
            ].join(' ')}
          >
            {product.inStock ? 'In stock' : 'Check stock'}
          </span>
        </div>
      </div>
    </article>
  );
}
