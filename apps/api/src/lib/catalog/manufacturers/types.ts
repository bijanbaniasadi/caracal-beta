/**
 * Manufacturer content fetcher interface (M2a).
 *
 * Each brand has its own implementation (autotuner.ts, alientech.ts, …). The
 * orchestrator routes by brand and asks for a specific product. Returned content
 * is everything we want to enrich an imported master with: canonical name, full
 * description, gallery image URLs (still hosted at the manufacturer), specs,
 * variants, and the manufacturer RRP (when published). The orchestrator handles
 * downloading images and updating master_products via the existing pricing path.
 *
 * Confidence: 0..1, drives the auto-publish gate later (Phase B). For M2a
 * enrichment of already-published products it's purely informational.
 */

export type SourceCurrency = 'AED' | 'USD' | 'EUR' | 'GBP';

export interface ManufacturerRrp {
  cents: bigint;
  currency: SourceCurrency;
}

export interface ManufacturerImage {
  sourceUrl: string;
  isPrimary: boolean;
  width?: number | null;
  height?: number | null;
  altText?: string | null;
}

export interface ManufacturerVariant {
  name: string;
  sku?: string | null;
  priceCents?: bigint | null;
  currency?: SourceCurrency | null;
}

export interface ManufacturerProductContent {
  canonicalName: string;
  description: string;
  rrp: ManufacturerRrp | null;
  images: ManufacturerImage[];
  specs: Record<string, string>;
  variants: ManufacturerVariant[];
  confidence: number;
  sourceUrl: string;
}

export interface ManufacturerFetcherInput {
  /** Brand-specific product handle (e.g. Shopify handle, WordPress slug). */
  handle: string;
  /** Optional variant selector when one page has multiple variants. */
  variantTitle?: string;
  /** Our internal SKU for logging / debugging. */
  ourSku?: string;
}

export interface ManufacturerFetcher {
  brandSlug: string;
  brandName: string;
  fetch(input: ManufacturerFetcherInput): Promise<ManufacturerProductContent>;
}
