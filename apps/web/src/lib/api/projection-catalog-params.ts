import type { ProjectionCatalogParams, ProjectionSortOption } from './projection-catalog-types';

export type ProjectionSearchParamRecord = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sortOption(value: string | undefined): ProjectionSortOption {
  const allowed = new Set<ProjectionSortOption>([
    'featured',
    'newest',
    'name',
    'price_asc',
    'price_desc',
  ]);
  return allowed.has(value as ProjectionSortOption) ? (value as ProjectionSortOption) : 'featured';
}

export function projectionParamsFromRecord(
  searchParams: ProjectionSearchParamRecord,
  fixed: { category?: string; manufacturer?: string } = {}
): ProjectionCatalogParams {
  const stock = first(searchParams.stock);
  return {
    q: first(searchParams.q) || undefined,
    category: fixed.category ?? first(searchParams.category) ?? undefined,
    manufacturer: fixed.manufacturer ?? first(searchParams.manufacturer) ?? undefined,
    inStock: stock === 'in' ? true : undefined,
    page: positiveInt(first(searchParams.page), 1),
    limit: 24,
    sort: sortOption(first(searchParams.sort)),
  };
}

export function projectionParamsFromUrlSearchParams(
  searchParams: URLSearchParams,
  fixed: { category?: string; manufacturer?: string } = {}
): ProjectionCatalogParams {
  return projectionParamsFromRecord(
    {
      q: searchParams.get('q') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      manufacturer: searchParams.get('manufacturer') ?? undefined,
      stock: searchParams.get('stock') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
    },
    fixed
  );
}
