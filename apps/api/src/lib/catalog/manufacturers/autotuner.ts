/**
 * AutoTuner manufacturer content fetcher (M2a).
 *
 * autotuner.com is a Shopify storefront, so we hit the structured product JSON
 * endpoint at /products/<handle>.json. That returns variants with prices in EUR,
 * compare_at_price (when set), images with widths/alt text, and a body_html
 * description. We do not scrape the HTML; the JSON is canonical.
 */
import type {
  ManufacturerFetcher,
  ManufacturerFetcherInput,
  ManufacturerProductContent,
  SourceCurrency,
} from './types.js';
import { safeFetch } from './web-transport.js';

const BASE_URL = 'https://www.autotuner.com';

interface ShopifyVariant {
  id: number;
  title: string;
  sku?: string | null;
  price?: string | null;
  compare_at_price?: string | null;
  price_currency?: string | null;
}

interface ShopifyImage {
  src?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

interface ShopifyProduct {
  title?: string | null;
  body_html?: string | null;
  vendor?: string | null;
  handle?: string | null;
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
}

function priceToCents(value: string | null | undefined): bigint | null {
  if (!value) return null;
  // Shopify returns "4900.00" (dot decimal). Some locales use "4.900,00" — handle both.
  const normalized = value.includes(',') && value.lastIndexOf(',') > value.lastIndexOf('.')
    ? value.replace(/\./g, '').replace(',', '.')
    : value.replace(/,/g, '');
  const number = Number.parseFloat(normalized);
  if (!Number.isFinite(number) || number <= 0) return null;
  return BigInt(Math.round(number * 100));
}

function asCurrency(value: string | null | undefined): SourceCurrency | null {
  const code = (value ?? '').trim().toUpperCase();
  if (code === 'EUR' || code === 'USD' || code === 'GBP' || code === 'AED') return code;
  return null;
}

function htmlToMarkdown(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function looksLikeMultiPack(variant: ShopifyVariant): boolean {
  const title = (variant.title ?? '').trim().toLowerCase();
  if (!title || title === 'default title') return false;
  // Any title that STARTS with a digit is a quantity ("10", "100", "100 (Custom logo printing incl.)").
  if (/^\d/.test(title)) return true;
  // Common multi-pack / bundled-printing markers.
  if (/\b(pack|pcs|pieces?|bundle|kit|qty|lot|custom logo|printing|incl\.|including|set of)\b/.test(title)) return true;
  return false;
}

function variantPriceFloat(variant: ShopifyVariant): number {
  const number = Number.parseFloat((variant.price ?? '0').replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function selectVariant(variants: ShopifyVariant[], variantTitle: string | undefined): ShopifyVariant | null {
  if (variants.length === 0) return null;
  if (variantTitle) {
    const needle = variantTitle.trim().toLowerCase();
    const exact = variants.find((v) => (v.title ?? '').trim().toLowerCase() === needle);
    if (exact) return exact;
    const partial = variants.find((v) => (v.title ?? '').trim().toLowerCase().includes(needle));
    if (partial) return partial;
  }
  // No explicit variant title → prefer the single-unit retail.
  // Multi-pack variants on Shopify carry the total pack price (€4,000 for a
  // 10-pack, €40,000 for 100, etc.), so single-unit is the LOWEST priced
  // non-zero entry once obvious quantity / bundle titles are filtered out.
  const singles = variants.filter((v) => !looksLikeMultiPack(v) && variantPriceFloat(v) > 0);
  const pool = singles.length > 0 ? singles : variants.filter((v) => variantPriceFloat(v) > 0);
  if (pool.length === 0) return variants[0];
  return pool.reduce<ShopifyVariant>(
    (best, current) => (variantPriceFloat(current) < variantPriceFloat(best) ? current : best),
    pool[0]
  );
}

function scoreConfidence(product: ShopifyProduct, rrpPresent: boolean): number {
  let score = 0;
  if ((product.title ?? '').trim().length > 3) score += 0.25;
  if ((product.body_html ?? '').trim().length > 100) score += 0.25;
  if ((product.images ?? []).length > 0) score += 0.25;
  if (rrpPresent) score += 0.25;
  return score;
}

export class AutotunerFetcher implements ManufacturerFetcher {
  readonly brandSlug = 'autotuner';
  readonly brandName = 'AutoTuner';

  async fetch(input: ManufacturerFetcherInput): Promise<ManufacturerProductContent> {
    const handle = input.handle.replace(/^\/+|\/+$/g, '');
    const sourceUrl = `${BASE_URL}/products/${handle}`;
    const jsonUrl = `${sourceUrl}.json`;

    const response = await safeFetch({ url: jsonUrl, acceptHeader: 'application/json' });
    if (!response.ok) {
      throw new Error(
        `AutoTuner fetch failed: ${response.status} for ${jsonUrl} (via ${response.via})`
      );
    }

    let parsed: { product?: ShopifyProduct } | null = null;
    try {
      parsed = JSON.parse(response.body) as { product?: ShopifyProduct };
    } catch (error) {
      throw new Error(`AutoTuner JSON parse failed for ${jsonUrl}: ${(error as Error).message}`);
    }
    const product = parsed?.product;
    if (!product) {
      throw new Error(`AutoTuner JSON missing 'product' for ${jsonUrl}`);
    }

    const variant = selectVariant(product.variants ?? [], input.variantTitle);
    const rrpCents = priceToCents(variant?.price);
    const rrpCurrency = asCurrency(variant?.price_currency) ?? 'EUR';
    const rrp = rrpCents !== null ? { cents: rrpCents, currency: rrpCurrency } : null;

    const images = (product.images ?? [])
      .filter((image): image is ShopifyImage & { src: string } => Boolean(image.src))
      .map((image, index) => ({
        sourceUrl: image.src,
        isPrimary: index === 0,
        width: image.width ?? null,
        height: image.height ?? null,
        altText: image.alt ?? null,
      }));

    const variants = (product.variants ?? []).map((v) => ({
      name: v.title ?? 'Default',
      sku: v.sku ?? null,
      priceCents: priceToCents(v.price),
      currency: asCurrency(v.price_currency),
    }));

    return {
      canonicalName: variant ? `${product.title} — ${variant.title}` : (product.title ?? handle),
      description: htmlToMarkdown(product.body_html),
      rrp,
      images,
      specs: { vendor: product.vendor ?? 'AutoTuner' },
      variants,
      confidence: scoreConfidence(product, rrp !== null),
      sourceUrl,
    };
  }
}
