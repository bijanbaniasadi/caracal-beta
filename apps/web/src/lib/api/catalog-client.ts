/**
 * Caracal API — Catalog (read-only) client
 *
 * Wraps the public projection routes mounted under /api/catalog/* by the API
 * server (see apps/api/src/routes/catalog-projection.ts). The shape returned
 * by the projection is normalised here to the existing web `Product` /
 * `Category` type so downstream components (ProductGrid, CategoryNav, …)
 * keep working unchanged.
 *
 * The /shop page reads from public_products (the curated layered catalog).
 * The legacy /api/products + /api/categories endpoints (operating on the
 * old 10k-row Product table) are no longer called from /shop.
 */

import { CaracalApiError } from './client';
import type {
  Category,
  CategoryRef,
  PaginationMeta,
  Product,
  ProductImage,
  ProductListParams,
  ProductPage,
} from './catalog-types';
import type { ApiErrorCode } from './types';

// ─── Base URL ─────────────────────────────────────────────────────────────────

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

// ─── Envelope helpers ─────────────────────────────────────────────────────────

interface CatalogMeta {
  requestId?: string;
  pagination?: PaginationMeta;
}

type CatalogEnvelope<T> =
  | { success: true; data: T; meta: CatalogMeta }
  | { success: false; error: { code: ApiErrorCode; message: string; details?: unknown }; meta: CatalogMeta };

type QueryParams = Record<string, string | number | boolean | undefined>;

async function catalogGet<T>(
  path: string,
  params?: QueryParams
): Promise<{ data: T; pagination: PaginationMeta | undefined }> {
  const url = new URL(`${getApiBase()}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch (networkError) {
    throw new CaracalApiError({
      code: 'internal_server_error',
      message:
        networkError instanceof Error ? networkError.message : 'Network request failed',
      status: 0,
    });
  }

  let body: CatalogEnvelope<T>;
  try {
    body = (await response.json()) as CatalogEnvelope<T>;
  } catch {
    throw new CaracalApiError({
      code: 'internal_server_error',
      message: `Server returned non-JSON response (HTTP ${response.status})`,
      status: response.status,
    });
  }

  if (body.success) {
    return { data: body.data, pagination: body.meta?.pagination };
  }

  throw new CaracalApiError({
    code: body.error.code,
    message: body.error.message,
    status: response.status,
    details: body.error.details,
    requestId: body.meta?.requestId,
  });
}

// ─── Projection row shape (loosely typed) ─────────────────────────────────────

interface ProjectionPriceFragment {
  priceCents?: number | null;
  currency?: string | null;
  formatted?: string | null;
}

interface ProjectionImageFragment {
  url?: string | null;
  altText?: string | null;
  isPrimary?: boolean | null;
  sortOrder?: number | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
}

interface ProjectionRow {
  publicId: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  longDescription: string | null;
  manufacturer?: { slug?: string | null; name?: string | null } | null;
  category?: { slug?: string | null; name?: string | null } | null;
  primaryImage?: ProjectionImageFragment | null;
  galleryImages?: ProjectionImageFragment[] | null;
  bestPrice?: ProjectionPriceFragment | null;
  sellPrice?: ProjectionPriceFragment | null;
  compareAt?: ProjectionPriceFragment | null;
  discountPct?: number | null;
  inStock?: boolean | null;
  featured?: boolean | null;
  publishedAt?: string | null;
  sourcingVendorName?: string | null;
}

// ─── Shape adapters ───────────────────────────────────────────────────────────

function imageFromFragment(
  fragment: ProjectionImageFragment | null | undefined,
  index: number,
  primaryFlag = false
): ProductImage | null {
  if (!fragment?.url) return null;
  return {
    id: `${index}`,
    url: fragment.url,
    altText: fragment.altText ?? null,
    sortOrder: typeof fragment.sortOrder === 'number' ? fragment.sortOrder : index,
    isPrimary: primaryFlag || fragment.isPrimary === true,
  };
}

function categoryRefFromProjection(
  category: ProjectionRow['category']
): CategoryRef | null {
  if (!category?.slug) return null;
  return {
    id: category.slug,
    slug: category.slug,
    name: category.name ?? category.slug,
  };
}

function productFromProjection(row: ProjectionRow): Product {
  const images: ProductImage[] = [];
  const primary = imageFromFragment(row.primaryImage, 0, true);
  if (primary) images.push(primary);
  for (let i = 0; i < (row.galleryImages?.length ?? 0); i += 1) {
    const img = imageFromFragment(row.galleryImages![i], images.length, false);
    if (img && !images.some((existing) => existing.url === img.url)) images.push(img);
  }

  const sellCents = row.sellPrice?.priceCents ?? null;
  const sellCurrency = row.sellPrice?.currency ?? 'AED';
  const sellFormatted = row.sellPrice?.formatted ?? null;
  const compareCents = row.compareAt?.priceCents ?? null;
  const compareFormatted = row.compareAt?.formatted ?? null;
  const inStock = row.inStock === true;

  return {
    id: row.publicId,
    sku: null,
    slug: row.slug,
    name: row.name,
    shortDescription: row.shortDescription,
    description: row.longDescription,
    status: 'ACTIVE',
    category: categoryRefFromProjection(row.category ?? null),
    supplier: row.sourcingVendorName
      ? { id: row.sourcingVendorName.toLowerCase(), name: row.sourcingVendorName, slug: row.sourcingVendorName.toLowerCase() }
      : null,
    price: {
      amountCents: sellCents,
      currency: sellCurrency,
      formatted: sellFormatted,
      tradeAmountCents: null,
      tradeFormatted: null,
      saleAmountCents: null,
      saleFormatted: null,
      oldAmountCents: compareCents,
      oldFormatted: compareFormatted,
      discountPercent: row.discountPct ?? null,
    },
    flags: {
      featured: row.featured === true,
      b2bEligible: false,
      tradeOnly: false,
    },
    inventory: {
      status: inStock ? 'IN_STOCK' : 'OUT_OF_STOCK',
      quantityOnHand: 0,
      quantityReserved: 0,
      quantityAvailable: inStock ? 1 : 0,
      reorderPoint: null,
      locations: [],
    },
    images,
    attributes: null,
    inquiry: {
      endpoint: '/api/inquiries',
      productId: row.publicId,
      productSku: null,
      productName: row.name,
    },
    publishedAt: row.publishedAt ?? null,
    createdAt: row.publishedAt ?? new Date(0).toISOString(),
    updatedAt: row.publishedAt ?? new Date(0).toISOString(),
  };
}

// ─── Param mapping ────────────────────────────────────────────────────────────

function mapListParams(params?: ProductListParams): QueryParams {
  if (!params) return {};
  const out: QueryParams = {};
  // Projection accepts `category` (slug). Web hook may pass `category` or `categorySlug`.
  const category = params.category ?? params.categorySlug;
  if (category) out.category = category;
  if (params.q) out.q = params.q;
  if (params.sort) out.sort = params.sort;
  if (params.limit) out.limit = params.limit;
  if (params.page) out.page = params.page;
  if (params.inStock !== undefined) out.inStock = params.inStock;
  if (params.featured !== undefined) out.featured = params.featured;
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getProducts(params?: ProductListParams): Promise<ProductPage> {
  const { data, pagination } = await catalogGet<ProjectionRow[]>(
    '/api/catalog/products',
    mapListParams(params)
  );
  return {
    items: data.map(productFromProjection),
    pagination: pagination ?? { limit: 24, hasMore: false, nextCursor: null },
  };
}

export async function searchProducts(
  params: ProductListParams & { q: string }
): Promise<ProductPage> {
  const { data, pagination } = await catalogGet<ProjectionRow[]>(
    '/api/catalog/search',
    mapListParams(params)
  );
  return {
    items: data.map(productFromProjection),
    pagination: pagination ?? { limit: 24, hasMore: false, nextCursor: null },
  };
}

export async function getProductBySlug(slug: string): Promise<Product> {
  const { data } = await catalogGet<ProjectionRow>(
    `/api/catalog/products/${encodeURIComponent(slug)}`
  );
  return productFromProjection(data);
}

interface ProjectionCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  parentId: string | null;
  counts: { products: number };
}

function categoryFromProjection(row: ProjectionCategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    parent: row.parentId ? null : null,
    children: [],
    sortOrder: row.sortOrder,
    isActive: true,
    metadata: null,
    counts: {
      children: 0,
      products: row.counts?.products ?? 0,
    },
    createdAt: '',
    updatedAt: '',
  };
}

export async function getCategories(_params?: {
  includeInactive?: boolean;
}): Promise<Category[]> {
  const { data } = await catalogGet<ProjectionCategoryRow[]>('/api/catalog/categories');
  return data.map(categoryFromProjection);
}
