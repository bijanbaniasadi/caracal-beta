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
  rrpCents: bigint | null;
  rrpCurrency: string | null;
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
  return decodeHtml(
    value
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
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

  const rawNumber = value.match(/(\d[\d,. ]*)/)?.[1]?.replace(/\s+/g, '');
  if (!rawNumber) return null;

  const lastComma = rawNumber.lastIndexOf(',');
  const lastDot = rawNumber.lastIndexOf('.');
  const decimalSeparator =
    lastComma > lastDot && rawNumber.length - lastComma <= 3
      ? ','
      : lastDot > lastComma && rawNumber.length - lastDot <= 3
        ? '.'
        : null;
  const normalized =
    decimalSeparator === ','
      ? rawNumber.replace(/\./g, '').replace(',', '.')
      : decimalSeparator === '.'
        ? rawNumber.replace(/,/g, '')
        : rawNumber.replace(/[,.]/g, '');

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

function parseRrpFromHtml(
  html: string,
  currentPriceCents: bigint | null
): {
  cents: bigint | null;
  currency: string | null;
  source: string | null;
} {
  const currency = parseCurrency(html);
  const compareAtJson = html.match(/"compare_at_price"\s*:\s*(\d+)/i)?.[1];

  if (compareAtJson) {
    const cents = BigInt(compareAtJson);
    if (!currentPriceCents || cents > currentPriceCents) {
      return { cents, currency, source: 'compare_at_price' };
    }
  }

  const text = stripTags(html);
  const explicit = text.match(
    /\b(RRP|MSRP|List price|Regular price|Was|Compare at)\b\s*:?\s*((?:AED|USD|EUR|GBP|[$\u20ac\u00a3])?\s*[\d,.]+(?:\s*(?:AED|USD|EUR|GBP))?)/iu
  );

  if (!explicit) {
    return { cents: null, currency: null, source: null };
  }

  const cents = parsePriceCents(explicit[2]);
  const rrpCurrency = parseCurrency(explicit[2], currency);

  if (!cents || (currentPriceCents && cents <= currentPriceCents)) {
    return { cents: null, currency: null, source: null };
  }

  return { cents, currency: rrpCurrency, source: explicit[1].toLowerCase() };
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

function fallbackImages(html: string, baseUrl: string): string[] {
  const urls = [
    ...Array.from(
      html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)
    ).map((match) => match[1]),
    ...Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi))
      .map((match) => match[1])
      .filter((url) => /products?|uploaded|cdn|images/i.test(url)),
  ];

  return Array.from(
    new Set(
      urls.map((url) => absolutizeUrl(url, baseUrl)).filter((url): url is string => Boolean(url))
    )
  );
}

function firstOffer(value: unknown): Record<string, unknown> {
  const offers = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
  const first = offers[0];
  return first && typeof first === 'object' ? (first as Record<string, unknown>) : {};
}

function readMetaDescription(html: string): string | null {
  return textValue(
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
  );
}

function readHeading(html: string): string | null {
  return (
    textValue(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ??
    textValue(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])?.replace(/\s+[|-]\s+.*$/, '') ??
    null
  );
}

function readSku(text: string): string | null {
  return (
    text.match(/\b(?:SKU|Product Number|Cod\.?|GTIN)\s*:?\s*([A-Z0-9][A-Z0-9+._-]{2,})/i)?.[1] ??
    null
  );
}

function readLabeledText(text: string, label: string): string | null {
  const match = text.match(new RegExp(`\\b${label}\\s*:?\\s*([^$\\u20ac\\u00a3]{2,80})`, 'i'));
  return match?.[1]?.replace(/\b(?:Availability|SKU|GTIN|Category)\b.*$/i, '').trim() || null;
}

function readPriceText(text: string): string | null {
  const eur = text.match(
    /(?:\u20ac\s*[\d,.]+|[\d,.]+\s*\u20ac|\(\s*\u20ac\s*[\d,.]+\s*\)|EUR\s*[\d,.]+|[\d,.]+\s*EUR)/i
  );
  if (eur) return eur[0].replace(/[()]/g, '').trim();

  return (
    text.match(/(?:AED|USD|GBP|[$\u00a3])\s*[\d,.]+|[\d,.]+\s*(?:AED|USD|GBP)/i)?.[0] ??
    null
  );
}

function looksLikeProductDetail(html: string, pageUrl: string): boolean {
  const text = stripTags(html);

  return (
    pageUrl.includes('/products/') ||
    /\bSKU\s*:/.test(text) ||
    /\bProduct Number\s*:/.test(text) ||
    /class=["'][^"']*(product-details|product-essential|product-name)[^"']*["']/i.test(html)
  );
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
  baseUrl: string,
  html: string
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
  const parsedPriceCents = parsePriceCents(rawPriceText);
  const rrp = parseRrpFromHtml(html, parsedPriceCents);
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
    parsedPriceCents,
    parsedCurrency,
    rrpCents: rrp.cents,
    rrpCurrency: rrp.currency,
    parsedInStock: parseAvailability(offer.availability),
    rawSpecs: {
      manufacturerSlug: manufacturer.slug,
      manufacturerName: manufacturer.name,
      mpnOrSku,
      variantKey,
      normalizedSku: slugifyCatalogValue(sku ?? mpnOrSku),
      source: 'json-ld',
      ...(rrp.source ? { rrpSource: rrp.source } : {}),
    },
    rawImageUrls: readImages(product.image, baseUrl),
    fingerprint,
  };
}

function fallbackProductLinks(
  html: string,
  pageUrl: string,
  baseUrl: string
): Mk3ExtractedProduct[] {
  const patterns = [
    /<a\b[^>]+href=["']([^"']*\/products\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    /<h2\b[^>]*class=["'][^"']*product-title[^"']*["'][^>]*>\s*<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi,
    /<h3\b[^>]*class=["'][^"']*product-title[^"']*["'][^>]*>\s*<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi,
  ];
  const seen = new Set<string>();
  const products: Mk3ExtractedProduct[] = [];

  for (const pattern of patterns) {
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
        rrpCents: null,
        rrpCurrency: null,
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
  }

  if (products.length === 0 && looksLikeProductDetail(html, pageUrl)) {
    const text = stripTags(html);
    const rawName = readHeading(html);
    if (rawName) {
      const sku = readSku(text);
      const manufacturerLabel = readLabeledText(text, 'Manufacturer');
      const rawPriceText = readPriceText(text);
      const parsedPriceCents = parsePriceCents(rawPriceText);
      const parsedCurrency = parseCurrency(rawPriceText, text);
      const rrp = parseRrpFromHtml(html, parsedPriceCents);
      const manufacturer = inferMk3Manufacturer(rawName, manufacturerLabel);
      const mpnOrSku = inferMk3MpnOrSku(rawName, sku);
      const variantKey = inferMk3VariantKey(rawName);
      products.push({
        vendorUrl: pageUrl,
        vendorSku: sku,
        rawName,
        rawDescription: readMetaDescription(html),
        rawPriceText,
        parsedPriceCents,
        parsedCurrency,
        rrpCents: rrp.cents,
        rrpCurrency: rrp.currency,
        parsedInStock: parseAvailability(text),
        rawSpecs: {
          manufacturerSlug: manufacturer.slug,
          manufacturerName: manufacturer.name,
          mpnOrSku,
          variantKey,
          normalizedSku: slugifyCatalogValue(sku ?? mpnOrSku),
          source: 'product-page-fallback',
          ...(rrp.source ? { rrpSource: rrp.source } : {}),
        },
        rawImageUrls: fallbackImages(html, baseUrl),
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
    .map((product) => normalizeJsonLdProduct(product, pageUrl, baseUrl, html))
    .filter((product): product is Mk3ExtractedProduct => Boolean(product));

  const products =
    jsonLdProducts.length > 0 ? jsonLdProducts : fallbackProductLinks(html, pageUrl, baseUrl);
  const byUrl = new Map<string, Mk3ExtractedProduct>();

  for (const product of products) {
    byUrl.set(product.vendorUrl, product);
  }

  return Array.from(byUrl.values());
}
