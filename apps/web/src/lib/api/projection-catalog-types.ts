export type ProjectionSortOption = 'featured' | 'newest' | 'name' | 'price_asc' | 'price_desc';

export interface ProjectionPagination {
  limit: number;
  page?: number | null;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ProjectionImage {
  url: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProjectionPrice {
  priceCents: number | null;
  currency: string;
  formatted: string | null;
}

export interface ProjectionCuratedPrice extends ProjectionPrice {}

export interface ProjectionVendorOffer extends ProjectionPrice {
  vendorName: string;
  inStock: boolean;
}

export interface ProjectionSpec {
  key?: string;
  value?: string;
  unit?: string | null;
}

export interface ProjectionCompatibility {
  make?: string | null;
  model?: string | null;
  year_from?: number | null;
  year_to?: number | null;
  ecu?: string | null;
  notes?: string | null;
}

export interface ProjectionProduct {
  publicId: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  longDescriptionMd: string | null;
  manufacturer: {
    slug: string;
    name: string;
  };
  category: {
    slug: string;
    name: string;
  };
  primaryImage: ProjectionImage | null;
  galleryImages: ProjectionImage[];
  sellPrice?: ProjectionPrice | null;
  compareAt?: ProjectionPrice | null;
  discountPct?: number | null;
  bestPrice: ProjectionPrice;
  curatedPrice: ProjectionCuratedPrice | null;
  inStock: boolean;
  offerCount: number;
  vendorOffers: ProjectionVendorOffer[];
  specs: ProjectionSpec[];
  compatibility: ProjectionCompatibility[];
  featured: boolean;
  publishedAt: string | null;
}

export interface ProjectionSearchProduct {
  publicId: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  manufacturer: {
    slug: string;
    name: string;
  };
  category: {
    slug: string;
    name: string;
  };
  primaryImage: ProjectionImage | null;
  sellPrice?: ProjectionPrice | null;
  compareAt?: ProjectionPrice | null;
  discountPct?: number | null;
  bestPrice: ProjectionPrice;
  inStock: boolean;
  offerCount: number;
  featured: boolean;
  publishedAt: number | string | null;
}

export interface ProjectionProductPage<T = ProjectionProduct> {
  items: T[];
  pagination: ProjectionPagination;
  facets?: unknown;
}

export interface ProjectionCatalogParams {
  q?: string;
  category?: string;
  manufacturer?: string;
  inStock?: boolean;
  page?: number;
  limit?: number;
  sort?: ProjectionSortOption;
}

export interface ProjectionRuntimeCheck {
  name: string;
  ok: boolean;
  details?: unknown;
}

export interface ProjectionRuntimeHealth {
  ok: boolean;
  checks: ProjectionRuntimeCheck[];
}
