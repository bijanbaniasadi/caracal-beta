// ─── Shared ───────────────────────────────────────────────────────────────────

export type InventoryStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'DISCONTINUED';

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type SortOption = 'featured' | 'newest' | 'name' | 'price_asc' | 'price_desc';

// ─── Category ─────────────────────────────────────────────────────────────────

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface CategoryChild extends CategoryRef {
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Category extends CategoryRef {
  description: string | null;
  parent: CategoryRef | null;
  children: CategoryChild[];
  sortOrder: number;
  isActive: boolean;
  metadata: unknown;
  counts: {
    children: number;
    products: number;
    directProducts?: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Product ──────────────────────────────────────────────────────────────────

export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductPrice {
  amountCents: number | null;
  currency: string;
  /** Pre-formatted string e.g. "AED 1,234.56" — null when price not set. */
  formatted: string | null;
  tradeAmountCents: number | null;
  tradeFormatted: string | null;
  saleAmountCents?: number | null;
  saleFormatted?: string | null;
  oldAmountCents?: number | null;
  oldFormatted?: string | null;
  discountPercent?: number | null;
}

export interface ProductInventory {
  status: InventoryStatus;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderPoint: number | null;
  locations: unknown[];
}

export interface ProductFlags {
  featured: boolean;
  b2bEligible: boolean;
  tradeOnly: boolean;
}

export interface ProductInquiryMeta {
  endpoint: string;
  productId: string;
  productSku: string | null;
  productName: string;
}

export interface Product {
  id: string;
  sku: string | null;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  status: ProductStatus;
  category: CategoryRef | null;
  supplier: { id: string; name: string; slug: string } | null;
  price: ProductPrice;
  flags: ProductFlags;
  inventory: ProductInventory;
  images: ProductImage[];
  attributes: unknown;
  inquiry: ProductInquiryMeta;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationMeta {
  limit: number;
  page?: number | null;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ProductPage {
  items: Product[];
  pagination: PaginationMeta;
}

// ─── Query params ─────────────────────────────────────────────────────────────

export interface ProductListParams {
  q?: string;
  category?: string;
  categorySlug?: string;
  supplier?: string;
  sku?: string;
  featured?: boolean;
  b2b?: boolean;
  tradeOnly?: boolean;
  inStock?: boolean;
  minPriceCents?: number;
  maxPriceCents?: number;
  cursor?: string;
  page?: number;
  limit?: number;
  sort?: SortOption;
}
