import type {
  ProjectionProduct,
  ProjectionSearchProduct,
  ProjectionPrice,
  ProjectionSpec,
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

type ProjectionCardProduct = ProjectionProduct | ProjectionSearchProduct;

function hasPrice(price: ProjectionPrice | null | undefined): price is ProjectionPrice {
  return Boolean(price && (price.formatted || typeof price.priceCents === 'number'));
}

export function primaryPrice(product: ProjectionCardProduct): ProjectionPrice | null {
  if (hasPrice(product.sellPrice)) return product.sellPrice;
  if ('curatedPrice' in product && hasPrice(product.curatedPrice)) return product.curatedPrice;
  if (hasPrice(product.bestPrice)) return product.bestPrice;
  return null;
}

export function priceLabel(product: ProjectionCardProduct): string {
  return primaryPrice(product)?.formatted ?? 'Request price';
}

export function compareAtLabel(product: ProjectionCardProduct): string | null {
  const primary = primaryPrice(product);
  const compareAt = product.compareAt;

  if (
    !primary ||
    !primary.formatted ||
    !compareAt?.formatted ||
    compareAt.currency !== primary.currency ||
    typeof primary.priceCents !== 'number' ||
    typeof compareAt.priceCents !== 'number' ||
    compareAt.priceCents <= primary.priceCents
  ) {
    return null;
  }

  return compareAt.formatted;
}

export function discountLabel(product: ProjectionCardProduct): string | null {
  const discountPct = product.discountPct;
  if (typeof discountPct !== 'number' || discountPct <= 0) return null;

  const value = Number.isInteger(discountPct)
    ? String(discountPct)
    : discountPct.toFixed(1).replace(/\.0$/, '');
  return `Save ${value}%`;
}

export function imageLabel(product: ProjectionCardProduct): string {
  return product.shortDescription ?? product.name;
}

export function productImageUrl(product: ProjectionCardProduct): string | null {
  return product.primaryImage?.url ?? null;
}

export function specChipLabel(spec: ProjectionSpec): string | null {
  const value = spec.value?.trim();
  if (!value) return null;

  const unit = spec.unit?.trim();
  return [value, unit].filter(Boolean).join(' ');
}
