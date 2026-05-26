import { listProjectedProducts, searchProjectedProducts } from './projection-catalog-client';
import type {
  ProjectionCatalogParams,
  ProjectionProduct,
  ProjectionProductPage,
  ProjectionSearchProduct,
} from './projection-catalog-types';

export async function getInitialProjectedCatalogPage(
  params: ProjectionCatalogParams,
  forceSearch = false
): Promise<{
  page: ProjectionProductPage<ProjectionProduct | ProjectionSearchProduct> | null;
  error: string | null;
}> {
  try {
    const page =
      forceSearch || params.q
        ? await searchProjectedProducts(params)
        : await listProjectedProducts(params);
    return { page, error: null };
  } catch (error) {
    return {
      page: null,
      error: error instanceof Error ? error.message : 'Catalog projection is unavailable.',
    };
  }
}
