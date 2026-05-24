/**
 * Caracal API — Catalog (read-only) client
 *
 * Wraps GET /api/products, GET /api/products/search, GET /api/products/:slug,
 * and GET /api/categories. All responses follow ApiEnvelope<T>; pagination data
 * lives in meta.pagination, not inside data.
 */

import { CaracalApiError } from './client';
import type {
  Category,
  Product,
  ProductListParams,
  ProductPage,
  PaginationMeta,
} from './catalog-types';
import type { ApiErrorCode } from './types';

// ─── Base URL ─────────────────────────────────────────────────────────────────

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

// ─── Catalog envelope type ────────────────────────────────────────────────────

interface CatalogMeta {
  requestId?: string;
  pagination?: PaginationMeta;
}

type CatalogEnvelope<T> =
  | { success: true; data: T; meta: CatalogMeta }
  | { success: false; error: { code: ApiErrorCode; message: string; details?: unknown }; meta: CatalogMeta };

// ─── Envelope-aware GET fetch ─────────────────────────────────────────────────

type QueryParams = Record<string, string | number | boolean | undefined>;

async function catalogGet<T>(
  path: string,
  params?: QueryParams,
): Promise<{ data: T; pagination: PaginationMeta | undefined }> {
  const url = new URL(`${getApiBase()}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // products list is public — no cache busting needed; Next.js default cache is fine
    });
  } catch (networkError) {
    throw new CaracalApiError({
      code: 'internal_server_error',
      message:
        networkError instanceof Error
          ? networkError.message
          : 'Network request failed',
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

// ─── Products ─────────────────────────────────────────────────────────────────

/**
 * GET /api/products
 *
 * Fetches a paginated list of products. Returns items + pagination meta.
 */
export async function getProducts(
  params?: ProductListParams,
): Promise<ProductPage> {
  const { data, pagination } = await catalogGet<Product[]>(
    '/api/products',
    params as unknown as QueryParams,
  );
  return {
    items: data,
    pagination: pagination ?? { limit: 24, hasMore: false, nextCursor: null },
  };
}

/**
 * GET /api/products/search?q=...
 *
 * Full-text product search. Returns items + pagination meta.
 */
export async function searchProducts(
  params: ProductListParams & { q: string },
): Promise<ProductPage> {
  const { data, pagination } = await catalogGet<Product[]>(
    '/api/products/search',
    params as unknown as QueryParams,
  );
  return {
    items: data,
    pagination: pagination ?? { limit: 24, hasMore: false, nextCursor: null },
  };
}

/**
 * GET /api/products/:slug
 *
 * Fetches a single product by its URL slug. Throws CaracalApiError (404) if
 * the product is not found.
 */
export async function getProductBySlug(slug: string): Promise<Product> {
  const { data } = await catalogGet<Product>(`/api/products/${encodeURIComponent(slug)}`);
  return data;
}

// ─── Categories ───────────────────────────────────────────────────────────────

/**
 * GET /api/categories
 *
 * Returns the full list of active (or all) categories. Each category includes
 * its children array and product count.
 */
export async function getCategories(
  params?: { includeInactive?: boolean },
): Promise<Category[]> {
  const { data } = await catalogGet<Category[]>(
    '/api/categories',
    params as unknown as QueryParams,
  );
  return data;
}
