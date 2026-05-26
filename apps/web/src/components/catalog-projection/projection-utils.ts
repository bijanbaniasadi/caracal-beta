import type {
  ProjectionProduct,
  ProjectionSearchProduct,
  ProjectionSortOption,
} from '@/lib/api/projection-catalog-types';

export const projectionSortOptions: Array<{ value: ProjectionSortOption; label: string }> = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name' },
  { value: 'price_asc', label: 'Price low' },
  { value: 'price_desc', label: 'Price high' },
];

export function isNewCatalogFrontendEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_NEW_CATALOG_FRONTEND === 'true' ||
    process.env.NEW_CATALOG_FRONTEND === 'true'
  );
}

export function priceLabel(product: ProjectionProduct | ProjectionSearchProduct): string {
  return product.bestPrice.formatted ?? 'Request price';
}

export function imageLabel(product: ProjectionProduct | ProjectionSearchProduct): string {
  return product.shortDescription ?? product.name;
}

export function productImageUrl(
  product: ProjectionProduct | ProjectionSearchProduct
): string | null {
  return product.primaryImage?.url ?? null;
}
