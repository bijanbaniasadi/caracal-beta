/**
 * B2B Catalog Type Definitions
 * Extended types for high-density technical product catalog
 * Location: apps/web/src/lib/api/b2b-catalog-types.ts
 */

import type { Product, Category } from './catalog-types';

export interface B2BProduct extends Omit<Product, 'price' | 'sku'> {
  /** Manufacturer/SKU code - uppercase monospace display */
  sku: string;
  /** Original retail price before discount (cents) */
  originalPrice?: number;
  /** Active selling price (cents) */
  price: number;
  /** Calculated discount percentage (0-100) */
  discountPercent?: number;
  /** Trade-only restricted flag */
  isTradeOnly: boolean;
  /** Detailed technical specifications */
  technicalSpecs?: TechnicalSpec[];
  /** Warranty/support info */
  warranty?: string;
  /** Lead time in days */
  leadTimeDays?: number;
  /** Bulk pricing tiers */
  volumePricing?: VolumePriceTier[];
}

export interface TechnicalSpec {
  label: string;
  value: string;
}

export interface VolumePriceTier {
  minQuantity: number;
  maxQuantity?: number;
  pricePerUnit: number;
  discountPercent?: number;
}

export interface B2BCategory extends Category {
  /** Total product count in category */
  productCount: number;
  /** Parent category ID for hierarchy */
  parentId?: string;
  /** Depth level for tree rendering (0 = root) */
  depth: number;
  /** Category icon/code for quick visual identification */
  icon?: string;
  /** Expanded state in sidebar (client-side only) */
  isExpanded?: boolean;
}

export interface B2BCategoryTree extends B2BCategory {
  /** Child categories */
  children: B2BCategoryTree[];
}

export interface FilterState {
  /** Selected category slug(s) */
  categories: string[];
  /** Selected price range [min, max] in currency units */
  priceRange?: [number, number];
  /** Stock status filters */
  stockStatus: StockStatusFilter[];
  /** Search query */
  searchQuery: string;
  /** Trade-only toggle */
  tradeOnly: boolean;
  /** Sort option */
  sortBy: SortOption;
}

export type StockStatusFilter = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'DISCONTINUED';
export type SortOption = 'featured' | 'price_asc' | 'price_desc' | 'newest' | 'sku_asc';

export interface QuoteItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}
