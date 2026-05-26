import {
  buildMk3Fingerprint,
  inferMk3Manufacturer,
  inferMk3MpnOrSku,
  inferMk3VariantKey,
  slugifyCatalogValue,
} from './fingerprint.js';

export interface Mk3ExtractedProduct {
  vendorUrl: string;
  vendorSku: string | null;
  rawName: string;
  rawDescription: string | null;
  rawPriceText: string | null;
  parsedPriceCents: bigint | null;
  parsedCurrency: string | null;
  parsedInStock: boolean | null;
  rawSpecs: Record<string, unknown>;
  rawImageUrls: string[];
  fingerprint: string;
}

interface JsonLdProduct {
  name?: unknown;
  sku?: unknown;
  mpn?: unknown;
  brand?: unknown;
  description?: unknown;
  image?: unknown;
  offers?: unknown;
  url?: unknown;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? stripTags(value) : null;
}

function absolutizeUrl(input: string, baseUrl: string): string | null {
  try {
    return new URL(input, baseUrl).toString();
  } catch {
    return null;
  }
}

function parsePriceCents(value: string | null): bigint | null {
  if (!value) return null;

  const normalized = value.replace(/[, ]/g, '').match(/(\d+(?:\.\d{1,2})?)/)?.[1];
  if (!normalized) return null;

  return BigInt(Math.round(Number.parseFloat(normalized) * 100));
}

function parseCurrency(...values: Array<string | null | undefined>): string | null {
  const joined = values.filter(Boolean).join(' ').toUpperCase();
  const match = joined.match(/\b(AED|USD|EUR|GBP)\b|[$\u20ac\u00a3]/u);

  if (!match) return null;
  if (match[0] === '$') return 'USD';
  if (match[0] === '\u20ac') return 'EUR';
  if (match[0] === '\u00a3') return 'GBP';
  return match[0];
}

function parseAvailability(value: unknown): boolean | null {
  const text = textValue(value)?.toLowerCase();
  if (!text) return null;
  if (text.includes('instock') || text.includes('in stock')) return true;
  if (text.includes('outofstock') || text.includes('out of stock')) return false;
  return null;
}

function readBrand(value: unknown): string | null {
  if (typeof value === 'string') return textValue(value);
  if (value && typeof value === 'object') {
    return textValue((value as { name?: unknown }).name);
  }
  return null;
}

function readImages(value: unknown, baseUrl: string): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const urls = values
    .map((item) => (typeof item === 'string' ? item : null))
    .filter((item): item is string => Boolean(item))
    .map((item) => absolutizeUrl(item, baseUrl))
    .filter((item): item is string => Boolean(item));

  return Array.from(new Set(urls));
}

function firstOffer(value: unknown): Record<string, unknown> {
  const offers = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
  const first = offers[0];
  return first && typeof first === 'object' ? (first as Record<string, unknown>) : {};
}

function walkJson(value: unknown, visit: (item: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, visit);
    return;
  }

  if (!value || typeof value !== 'object') return;

  const object = value as Record<string, unknown>;
  visit(object);
  for (const child of Object.values(object)) {
    walkJson(child, visit);
  }
}

function parseJsonLdProducts(html: string): JsonLdProduct[] {
  const products: JsonLdProduct[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1].trim()));
      walkJson(parsed, (item) => {
        const type = item['@type'];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((entry) => String(entry).toLowerCase() === 'product')) {
          products.push(item as JsonLdProduct);
        }
      });
    } catch {
      continue;
    }
  }

  return products;
}

function normalizeJsonLdProduct(
  product: JsonLdProduct,
  pageUrl: string,
  baseUrl: string
): Mk3ExtractedProduct | null {
  const rawName = textValue(product.name);
  const vendorUrl = textValue(product.url)
    ? absolutizeUrl(textValue(product.url) ?? '', baseUrl)
    : pageUrl;

  if (!rawName || !vendorUrl) return null;

  const offer = firstOffer(product.offers);
  const brand = readBrand(product.brand);
  const sku = textValue(product.sku);
  const mpn = textValue(product.mpn);
  const rawPriceText = textValue(offer.price) ?? null;
  const parsedCurrency = parseCurrency(textValue(offer.priceCurrency), rawPriceText);
  const manufacturer = inferMk3Manufacturer(rawName, brand);
  const mpnOrSku = inferMk3MpnOrSku(rawName, sku, mpn);
  const variantKey = inferMk3VariantKey(rawName);
  const fingerprint = buildMk3Fingerprint({
    manufacturerSlug: manufacturer.slug,
    manufacturerName: manufacturer.name,
    mpnOrSku,
    variantKey,
  });

  return {
    vendorUrl,
    vendorSku: sku ?? mpn,
    rawName,
    rawDescription: textValue(product.description),
    rawPriceText,
    parsedPriceCents: parsePriceCents(rawPriceText),
    parsedCurrency,
    parsedInStock: parseAvailability(offer.availability),
    rawSpecs: {
      manufacturerSlug: manufacturer.slug,
      manufacturerName: manufacturer.name,
      mpnOrSku,
      variantKey,
      normalizedSku: slugifyCatalogValue(sku ?? mpnOrSku),
      source: 'json-ld',
    },
    rawImageUrls: readImages(product.image, baseUrl),
    fingerprint,
  };
}

function fallbackProductLinks(html: string, pageUrl: string, baseUrl: string): Mk3ExtractedProduct[] {
  const pattern = /<a\b[^>]+href=["']([^"']*\/products\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const products: Mk3ExtractedProduct[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    const vendorUrl = absolutizeUrl(match[1], baseUrl);
    const rawName = stripTags(match[2]);
    if (!vendorUrl || !rawName || seen.has(vendorUrl)) continue;
    seen.add(vendorUrl);

    const manufacturer = inferMk3Manufacturer(rawName);
    const mpnOrSku = inferMk3MpnOrSku(rawName);
    const variantKey = inferMk3VariantKey(rawName);

    products.push({
      vendorUrl,
      vendorSku: null,
      rawName,
      rawDescription: null,
      rawPriceText: null,
      parsedPriceCents: null,
      parsedCurrency: null,
      parsedInStock: null,
      rawSpecs: {
        manufacturerSlug: manufacturer.slug,
        manufacturerName: manufacturer.name,
        mpnOrSku,
        variantKey,
        source: 'product-link',
      },
      rawImageUrls: [],
      fingerprint: buildMk3Fingerprint({
        manufacturerSlug: manufacturer.slug,
        manufacturerName: manufacturer.name,
        mpnOrSku,
        variantKey,
      }),
    });
  }

  if (products.length === 0 && pageUrl.includes('/products/')) {
    const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    const rawName = title.replace(/\s+[|-]\s+.*$/, '').trim();
    if (rawName) {
      const manufacturer = inferMk3Manufacturer(rawName);
      const mpnOrSku = inferMk3MpnOrSku(rawName);
      const variantKey = inferMk3VariantKey(rawName);
      products.push({
        vendorUrl: pageUrl,
        vendorSku: null,
        rawName,
        rawDescription: stripTags(
          html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
            ''
        ),
        rawPriceText: null,
        parsedPriceCents: null,
        parsedCurrency: null,
        parsedInStock: null,
        rawSpecs: {
          manufacturerSlug: manufacturer.slug,
          manufacturerName: manufacturer.name,
          mpnOrSku,
          variantKey,
          source: 'product-page-fallback',
        },
        rawImageUrls: [],
        fingerprint: buildMk3Fingerprint({
          manufacturerSlug: manufacturer.slug,
          manufacturerName: manufacturer.name,
          mpnOrSku,
          variantKey,
        }),
      });
    }
  }

  return products;
}

export function extractMk3ProductsFromHtml(
  html: string,
  pageUrl: string,
  baseUrl: string
): Mk3ExtractedProduct[] {
  const jsonLdProducts = parseJsonLdProducts(html)
    .map((product) => normalizeJsonLdProduct(product, pageUrl, baseUrl))
    .filter((product): product is Mk3ExtractedProduct => Boolean(product));

  const products = jsonLdProducts.length > 0 ? jsonLdProducts : fallbackProductLinks(html, pageUrl, baseUrl);
  const byUrl = new Map<string, Mk3ExtractedProduct>();

  for (const product of products) {
    byUrl.set(product.vendorUrl, product);
  }

  return Array.from(byUrl.values());
}
