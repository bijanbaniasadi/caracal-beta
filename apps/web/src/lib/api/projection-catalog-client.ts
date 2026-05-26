import { CaracalApiError } from './client';
import type {
  ProjectionCatalogParams,
  ProjectionPagination,
  ProjectionProduct,
  ProjectionProductPage,
  ProjectionRuntimeHealth,
  ProjectionSearchProduct,
} from './projection-catalog-types';
import type { ApiErrorCode } from './types';

interface ApiMeta {
  requestId?: string;
  pagination?: ProjectionPagination;
  facets?: unknown;
}

type ApiEnvelope<T> =
  | { success: true; data: T; meta: ApiMeta }
  | {
      success: false;
      error: { code: ApiErrorCode; message: string; details?: unknown };
      meta: ApiMeta;
    };

type QueryParams = Record<string, string | number | boolean | undefined>;

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

function paramsToQuery(params?: ProjectionCatalogParams): QueryParams {
  return {
    q: params?.q,
    category: params?.category,
    manufacturer: params?.manufacturer,
    inStock: params?.inStock,
    page: params?.page,
    limit: params?.limit,
    sort: params?.sort,
  };
}

async function projectionGet<T>(
  path: string,
  params?: QueryParams
): Promise<{ data: T; meta: ApiMeta }> {
  const url = new URL(`${getApiBase()}${path}`);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch (error) {
    throw new CaracalApiError({
      code: 'internal_server_error',
      message: error instanceof Error ? error.message : 'Network request failed',
      status: 0,
    });
  }

  let body: ApiEnvelope<T>;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new CaracalApiError({
      code: 'internal_server_error',
      message: `Server returned non-JSON response (HTTP ${response.status})`,
      status: response.status,
    });
  }

  if (body.success) return { data: body.data, meta: body.meta };

  throw new CaracalApiError({
    code: body.error.code,
    message: body.error.message,
    status: response.status,
    details: body.error.details,
    requestId: body.meta?.requestId,
  });
}

function pageFrom<T>(data: T[], meta: ApiMeta, limit: number): ProjectionProductPage<T> {
  return {
    items: data,
    pagination: meta.pagination ?? {
      limit,
      hasMore: false,
      nextCursor: null,
    },
    facets: meta.facets,
  };
}

export async function listProjectedProducts(
  params?: ProjectionCatalogParams
): Promise<ProjectionProductPage> {
  const { data, meta } = await projectionGet<ProjectionProduct[]>(
    '/api/catalog/products',
    paramsToQuery(params)
  );
  return pageFrom(data, meta, params?.limit ?? 24);
}

export async function searchProjectedProducts(
  params: ProjectionCatalogParams
): Promise<ProjectionProductPage<ProjectionSearchProduct>> {
  const { data, meta } = await projectionGet<ProjectionSearchProduct[]>(
    '/api/catalog/search',
    paramsToQuery(params)
  );
  return pageFrom(data, meta, params.limit ?? 24);
}

export async function getProjectedProduct(slug: string): Promise<ProjectionProduct> {
  const { data } = await projectionGet<ProjectionProduct>(
    `/api/catalog/products/${encodeURIComponent(slug)}`
  );
  return data;
}

export async function getProjectedCategory(slug: string): Promise<{
  slug: string;
  name: string;
  product_count: number;
  min_price_cents: number | null;
}> {
  const { data } = await projectionGet<{
    slug: string;
    name: string;
    product_count: number;
    min_price_cents: number | null;
  }>(`/api/catalog/categories/${encodeURIComponent(slug)}`);
  return data;
}

export async function getProjectedManufacturer(slug: string): Promise<{
  slug: string;
  name: string;
  product_count: number;
  min_price_cents: number | null;
}> {
  const { data } = await projectionGet<{
    slug: string;
    name: string;
    product_count: number;
    min_price_cents: number | null;
  }>(`/api/catalog/manufacturers/${encodeURIComponent(slug)}`);
  return data;
}

export async function validateProjectionCatalogRuntime(): Promise<ProjectionRuntimeHealth> {
  const { data } = await projectionGet<ProjectionRuntimeHealth>('/api/catalog/health');
  return data;
}
