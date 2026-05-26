import 'dotenv/config';

import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  Prisma,
  PrismaClient,
  type InventoryStatus,
  type StagingProductStatus,
  type SupplierSyncMode,
} from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_LIMIT_PER_SOURCE = 25;
const DEFAULT_REQUEST_DELAY_MS = 750;
const USER_AGENT =
  process.env.SUPPLIER_SYNC_USER_AGENT ??
  'CaracalTechMotorsCatalogBot/1.0 (+https://caracaltechmotors.com)';
const TARGET_CURRENCY = 'AED';
const USD_AED = Number.parseFloat(process.env.SUPPLIER_SYNC_USD_AED ?? '3.67');
const EUR_AED = Number.parseFloat(process.env.SUPPLIER_SYNC_EUR_AED ?? '4.00');
const GBP_AED = Number.parseFloat(process.env.SUPPLIER_SYNC_GBP_AED ?? '4.70');

interface SourceConfig {
  slug: string;
  name: string;
  baseUrl: string;
  currency: string;
  connectorType: 'woocommerce' | 'nopcommerce' | 'legacy-iis';
  supplierTerms: string[];
  discoveryPaths: string[];
  productPathHints: string[];
  weakSkuTerms: string[];
}

interface CliOptions {
  mode: SupplierSyncMode;
  sources: string[];
  limit: number;
  delayMs: number;
  skipRobots: boolean;
}

interface RawProduct {
  sourceProductKey: string;
  externalUrl: string;
  externalSku: string | null;
  name: string;
  brand: string | null;
  categoryName: string | null;
  priceCents: number | null;
  currency: string | null;
  stockStatus: InventoryStatus;
  imageUrl: string | null;
  rawData: Prisma.InputJsonValue;
}

interface NormalizedProduct extends RawProduct {
  normalizedSku: string | null;
  normalizedName: string;
  convertedPriceCents: number | null;
  salePriceCents: number | null;
  oldPriceCents: number | null;
  status: StagingProductStatus;
  warnings: string[];
  rejectReasons: string[];
  description: string | null;
  shortDescription: string | null;
  imageApproved: boolean;
}

const SOURCE_CONNECTORS: SourceConfig[] = [
  {
    slug: 'automaxtools',
    name: 'Automax Tools',
    baseUrl: 'https://automaxtools.me',
    currency: 'AED',
    connectorType: 'woocommerce',
    supplierTerms: ['automaxtools', 'automax tools', 'automax', 'automaxtools.me'],
    discoveryPaths: [
      '/',
      '/shop/',
      '/product-category/diagnostic-tools/',
      '/product-category/key-programming-tools/',
      '/product-category/ecu-programming-tools/',
    ],
    productPathHints: ['/product/'],
    weakSkuTerms: ['AUTEL', 'LAUNCH', 'OBDSTAR', 'XHORSE', 'YANHUA'],
  },
  {
    slug: 'mk3',
    name: 'MK3',
    baseUrl: 'https://www.mk3.com',
    currency: 'USD',
    connectorType: 'nopcommerce',
    supplierTerms: ['mk3', 'mk3.com', 'www.mk3.com'],
    discoveryPaths: ['/', '/shop', '/products', '/key-programming', '/diagnostic-tools'],
    productPathHints: ['/product/', '/products/', '.html'],
    weakSkuTerms: ['AUTEL', 'LAUNCH', 'OBDSTAR', 'XHORSE', 'YANHUA'],
  },
  {
    slug: 'obdii365',
    name: 'OBDII365',
    baseUrl: 'https://www.obdii365.com',
    currency: 'USD',
    connectorType: 'legacy-iis',
    supplierTerms: ['obdii365', 'obdii365.com', 'www.obdii365.com'],
    discoveryPaths: [
      '/',
      '/wholesale/',
      '/wholesale/ecu-chip-tuning-tools/',
      '/wholesale/car-diagnostic-tools/',
      '/wholesale/key-programming-tools/',
      '/wholesale/original-autel-tools/',
      '/wholesale/original-obdstar-tools/',
    ],
    productPathHints: ['/wholesale/', '.html'],
    weakSkuTerms: ['AUTEL', 'LAUNCH', 'OBDSTAR', 'XHORSE', 'YANHUA', 'CGDI'],
  },
  {
    slug: 'uobdii',
    name: 'UOBDII',
    baseUrl: 'https://www.uobdii.com',
    currency: 'USD',
    connectorType: 'legacy-iis',
    supplierTerms: ['uobdii', 'uobdii.com', 'www.uobdii.com'],
    discoveryPaths: [
      '/',
      '/wholesale/',
      '/wholesale/ecu-chip-tuning/',
      '/wholesale/car-diagnostic-tool/',
      '/wholesale/original-autel-tool/',
      '/wholesale/original-obdstar-tool/',
      '/wholesale/original-xhorse-tool/',
    ],
    productPathHints: ['/wholesale/', '.html'],
    weakSkuTerms: ['AUTEL', 'LAUNCH', 'OBDSTAR', 'XHORSE', 'YANHUA', 'CGDI'],
  },
];

function parseOptions(): CliOptions {
  const args = process.argv.slice(2);
  const argValue = (name: string): string | undefined => {
    const match = args.find((arg) => arg.startsWith(`--${name}=`));
    return match?.split('=').slice(1).join('=');
  };

  const modeInput = (argValue('mode') ?? 'dry-run').toLowerCase();
  const mode =
    modeInput === 'publish' ? 'PUBLISH' : modeInput === 'stage' ? 'STAGE' : 'DRY_RUN';
  const sources = (argValue('sources') ?? SOURCE_CONNECTORS.map((source) => source.slug).join(','))
    .split(',')
    .map((source) => source.trim())
    .filter(Boolean);
  const limit = Number.parseInt(argValue('limit') ?? '', 10);
  const delayMs = Number.parseInt(argValue('delay-ms') ?? '', 10);

  return {
    mode,
    sources,
    limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT_PER_SOURCE,
    delayMs:
      Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : DEFAULT_REQUEST_DELAY_MS,
    skipRobots: args.includes('--skip-robots'),
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function textFromHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '-')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned : null;
}

function cleanTextValue(value: string | null | undefined): string | null {
  return compact(value ? textFromHtml(value) : null);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function hash(value: string, length = 12): string {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

function sourceHeaders(source?: SourceConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'User-Agent': USER_AGENT,
  };

  if (source?.connectorType === 'legacy-iis') {
    headers.Accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
  }

  return headers;
}

async function fetchText(url: string, source?: SourceConfig): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: sourceHeaders(source),
      redirect: 'follow',
    });

    if (!response.ok) {
      console.warn(`Fetch skipped ${url}: HTTP ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.warn(`Fetch failed ${url}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function getRobotsSummary(source: SourceConfig): Promise<{
  allowed: boolean;
  summary: string;
}> {
  const robotsUrl = new URL('/robots.txt', source.baseUrl).toString();
  const body = await fetchText(robotsUrl, source);
  if (!body) {
    return { allowed: true, summary: 'robots.txt not reachable; sync limited to polite crawl' };
  }

  const lower = body.toLowerCase();
  const disallowAllForAll =
    /user-agent:\s*\*\s*(?:\r?\n(?!user-agent:).*)*disallow:\s*\/\s*(?:\r?\n|$)/i.test(body);

  return {
    allowed: !disallowAllForAll,
    summary: lower.includes('crawl-delay')
      ? 'robots.txt present with crawl-delay guidance'
      : 'robots.txt present',
  };
}

function extractUrls(htmlOrXml: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  const locMatches = htmlOrXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi);
  for (const match of locMatches) {
    urls.add(match[1]);
  }

  const hrefMatches = htmlOrXml.matchAll(/\bhref=["']([^"']+)["']/gi);
  for (const match of hrefMatches) {
    try {
      urls.add(new URL(match[1], baseUrl).toString());
    } catch {
      // Ignore invalid links.
    }
  }

  return [...urls];
}

function isLikelyProductUrl(source: SourceConfig, url: string): boolean {
  try {
    const parsed = new URL(url);
    const sourceHost = new URL(source.baseUrl).hostname.replace(/^www\./, '');
    const host = parsed.hostname.replace(/^www\./, '');
    if (host !== sourceHost) return false;

    const path = parsed.pathname.toLowerCase();
    if (
      /\/(cart|checkout|account|login|blog|news|contact|privacy|terms|wishlist|compare)\b/.test(
        path
      )
    ) {
      return false;
    }

    if (source.connectorType === 'woocommerce') {
      return path.startsWith('/product/');
    }

    if (source.connectorType === 'legacy-iis') {
      return (
        path.startsWith('/wholesale/')
        && path.endsWith('.html')
        && !path.includes('/brand-')
        && !path.includes('/producttags/')
        && !path.includes('/vendors/')
      );
    }

    return source.productPathHints.some((hint) => path.includes(hint.toLowerCase()));
  } catch {
    return false;
  }
}

async function discoverProductUrls(source: SourceConfig, limit: number): Promise<string[]> {
  const candidates = new Set<string>();
  const sitemapUrls = [
    new URL('/sitemap.xml', source.baseUrl).toString(),
    new URL('/sitemap_index.xml', source.baseUrl).toString(),
    new URL('/product-sitemap.xml', source.baseUrl).toString(),
    new URL('/sitemap_products_1.xml', source.baseUrl).toString(),
  ];

  for (const sitemapUrl of sitemapUrls) {
    if (candidates.size >= limit) break;
    const sitemap = await fetchText(sitemapUrl, source);
    if (!sitemap) continue;

    for (const url of extractUrls(sitemap, source.baseUrl)) {
      if (isLikelyProductUrl(source, url)) {
        candidates.add(url);
      }
      if (candidates.size >= limit) break;
    }
  }

  for (const discoveryPath of source.discoveryPaths) {
    if (candidates.size >= limit) break;
    const pageUrl = new URL(discoveryPath, source.baseUrl).toString();
    const page = await fetchText(pageUrl, source);
    if (!page) continue;

    for (const url of extractUrls(page, source.baseUrl)) {
      if (isLikelyProductUrl(source, url)) {
        candidates.add(url);
      }
      if (candidates.size >= limit) break;
    }
  }

  return [...candidates].slice(0, limit);
}

function parseJsonLd(html: string): unknown[] {
  const values: unknown[] = [];
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const script of scripts) {
    const raw = script[1]
      .replace(/<!--/g, '')
      .replace(/-->/g, '')
      .trim();
    if (!raw) continue;

    try {
      values.push(JSON.parse(raw));
    } catch {
      // Many sites include invalid JSON-LD. The fallback parser still handles the page.
    }
  }

  return values;
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }
  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const graph = record['@graph'];
  return [record, ...flattenJsonLd(graph)];
}

function findProductSchema(values: unknown[]): Record<string, unknown> | null {
  for (const value of values.flatMap(flattenJsonLd)) {
    const type = value['@type'];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((item) => String(item).toLowerCase() === 'product')) {
      return value;
    }
  }

  return null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return cleanTextValue(value);
  if (typeof value === 'number') return String(value);
  return null;
}

function firstString(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = firstString(item);
      if (result) return result;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      stringValue(record.url) ??
      stringValue(record.contentUrl) ??
      stringValue(record.image) ??
      null
    );
  }
  return stringValue(value);
}

function parsePriceFromText(value: string): { cents: number; currency: string | null } | null {
  const match = value.match(
    /(AED|USD|EUR|GBP|US\$|DHS?|د\.إ|\$|€|£)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
  );
  if (!match) return null;

  const amount = Number.parseFloat(match[2].replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;

  const symbol = match[1]?.toUpperCase();
  const currency =
    symbol === '$' || symbol === 'US$'
      ? 'USD'
      : symbol === '€'
        ? 'EUR'
        : symbol === '£'
          ? 'GBP'
          : symbol === 'د.إ' || symbol === 'DH' || symbol === 'DHS'
            ? 'AED'
            : symbol ?? null;

  return { cents: Math.round(amount * 100), currency };
}

function offerRecord(productSchema: Record<string, unknown>): Record<string, unknown> | null {
  const offers = productSchema.offers;
  if (Array.isArray(offers)) {
    return (offers.find((offer) => offer && typeof offer === 'object') ??
      null) as Record<string, unknown> | null;
  }
  return offers && typeof offers === 'object' ? (offers as Record<string, unknown>) : null;
}

function parseStockStatus(productSchema: Record<string, unknown> | null, pageText: string): InventoryStatus {
  const availability = productSchema ? String(offerRecord(productSchema)?.availability ?? '') : '';
  const text = `${availability} ${pageText}`.toLowerCase();

  if (/discontinued/.test(text)) return 'DISCONTINUED';
  if (/out\s*of\s*stock|sold\s*out|unavailable/.test(text)) return 'OUT_OF_STOCK';
  if (/low\s*stock|limited\s*stock/.test(text)) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function metaContent(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return compact(textFromHtml(match[1]));
  }

  return null;
}

function titleFromHtml(html: string): string | null {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return cleanTextValue(h1);

  const og = metaContent(html, 'og:title');
  if (og) return og;

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? cleanTextValue(textFromHtml(title).replace(/\s*[|-]\s*.+$/, '')) : null;
}

function isWeakSku(value: string | null, source: SourceConfig): boolean {
  if (!value) return true;
  const sku = value.trim().toUpperCase();
  if (sku.length < 4) return true;
  if (/^(SKU|MODEL|ITEM|PRODUCT|CODE|N\/A|NONE|UNKNOWN)$/.test(sku)) return true;
  return source.weakSkuTerms.some((term) => sku === term || sku === `${term}-`);
}

function normalizeExternalSku(value: string | null | undefined, source: SourceConfig): string | null {
  const sku = value?.toUpperCase().replace(/[^\w.-]+/g, '').slice(0, 80) ?? null;
  return isWeakSku(sku, source) ? null : sku;
}

function skuFromHtml(html: string, source: SourceConfig): string | null {
  const text = textFromHtml(html);
  const match = text.match(/\b(?:SKU|Model|Item\s*No\.?|Product\s*Code)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i);
  return normalizeExternalSku(match?.[1], source);
}

async function parseProductPage(source: SourceConfig, url: string): Promise<RawProduct | null> {
  const html = await fetchText(url, source);
  if (!html) return null;

  const pageText = textFromHtml(html);
  const productSchema = findProductSchema(parseJsonLd(html));
  const offers = productSchema ? offerRecord(productSchema) : null;
  const schemaName = productSchema ? stringValue(productSchema.name) : null;
  const name = schemaName ?? titleFromHtml(html);
  if (!name) return null;

  const schemaSku =
    productSchema && (stringValue(productSchema.sku) ?? stringValue(productSchema.mpn));
  const externalSku = normalizeExternalSku(schemaSku, source) ?? skuFromHtml(html, source);
  const schemaBrand =
    productSchema && productSchema.brand && typeof productSchema.brand === 'object'
      ? stringValue((productSchema.brand as Record<string, unknown>).name)
      : productSchema
        ? stringValue(productSchema.brand)
        : null;
  const rawPrice =
    offers && offers.price !== undefined
      ? {
          cents: Math.round(Number(String(offers.price).replace(/,/g, '')) * 100),
          currency: stringValue(offers.priceCurrency),
        }
      : parsePriceFromText(pageText);

  const priceCents =
    rawPrice && Number.isFinite(rawPrice.cents) && rawPrice.cents > 0 ? rawPrice.cents : null;
  const currency = rawPrice?.currency ?? source.currency;
  const schemaImage = productSchema ? firstString(productSchema.image) : null;
  const imageUrl = schemaImage ?? metaContent(html, 'og:image');
  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? url;
  const externalUrl = new URL(canonical, source.baseUrl).toString();
  const sourceProductKey = externalSku
    ? `${source.slug}:${externalSku.toUpperCase()}`
    : `${source.slug}:${hash(externalUrl, 20)}`;

  return {
    sourceProductKey,
    externalUrl,
    externalSku,
    name,
    brand: schemaBrand,
    categoryName: null,
    priceCents,
    currency,
    stockStatus: parseStockStatus(productSchema, pageText),
    imageUrl: imageUrl ? new URL(imageUrl, source.baseUrl).toString() : null,
    rawData: toJson({
      jsonLdProduct: productSchema,
      parsedAt: new Date().toISOString(),
      parser: 'jsonld-with-html-fallback',
    }),
  };
}

function removeSupplierTerms(text: string, source: SourceConfig): string {
  let next = text;
  for (const term of source.supplierTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(escaped, 'gi'), 'Caracal Tech Motors');
  }

  return next.replace(/\s+/g, ' ').trim();
}

function convertToAedCents(cents: number | null, currency: string | null): number | null {
  if (cents === null) return null;
  const normalized = (currency ?? TARGET_CURRENCY).toUpperCase();
  const amount = cents / 100;

  if (normalized === 'AED') return cents;
  if (normalized === 'USD') return Math.round(amount * USD_AED * 100);
  if (normalized === 'EUR') return Math.round(amount * EUR_AED * 100);
  if (normalized === 'GBP') return Math.round(amount * GBP_AED * 100);
  return null;
}

function buildCaracalDescription(name: string, categoryName: string | null): {
  shortDescription: string;
  description: string;
} {
  const subject = categoryName ? `${categoryName.toLowerCase()} product` : 'automotive workshop product';
  const shortDescription = `${name} supplied through Caracal Tech Motors with compatibility confirmation before dispatch.`;
  const description = `${name} is available through Caracal Tech Motors for professional automotive workshops in the UAE and GCC. This ${subject} is listed from a monitored supplier feed and should be confirmed for vehicle, ECU, key, diagnostic, or workshop compatibility before ordering. Contact Caracal Tech Motors for stock confirmation, delivery timing, and technical fitment support.`;

  return { shortDescription, description };
}

function hasSupplierTerm(text: string, source: SourceConfig): boolean {
  const lower = text.toLowerCase();
  return source.supplierTerms.some((term) => lower.includes(term.toLowerCase()));
}

function normalizeProduct(source: SourceConfig, raw: RawProduct): NormalizedProduct {
  const warnings: string[] = [];
  const rejectReasons: string[] = [];
  const normalizedName = removeSupplierTerms(raw.name, source);
  const normalizedSku = normalizeExternalSku(raw.externalSku, source);
  const convertedPriceCents = convertToAedCents(raw.priceCents, raw.currency);
  const salePriceCents =
    convertedPriceCents === null ? null : Math.max(Math.round(convertedPriceCents * 1.15), 1);
  const oldPriceCents =
    salePriceCents === null ? null : Math.max(Math.round(salePriceCents / 0.9), salePriceCents);
  const imageApproved = false;

  if (!normalizedName || normalizedName.length < 3) {
    rejectReasons.push('missing_product_name');
  }
  if (convertedPriceCents === null || salePriceCents === null || oldPriceCents === null) {
    rejectReasons.push('missing_or_unsupported_price');
  }
  if (!normalizedSku) {
    warnings.push('missing_external_sku');
  }
  if (hasSupplierTerm(normalizedName, source)) {
    rejectReasons.push('supplier_name_not_removed_from_product_name');
  }
  if (raw.imageUrl) {
    warnings.push('image_requires_manual_brand_review');
  }
  if (raw.stockStatus === 'DISCONTINUED') {
    warnings.push('supplier_reports_discontinued');
  }

  const { shortDescription, description } = buildCaracalDescription(
    normalizedName,
    raw.categoryName
  );
  const status: StagingProductStatus = 'PENDING';

  return {
    ...raw,
    normalizedSku,
    normalizedName,
    convertedPriceCents,
    salePriceCents,
    oldPriceCents,
    status,
    warnings,
    rejectReasons,
    description,
    shortDescription,
    imageApproved,
  };
}

async function upsertSource(source: SourceConfig, robots: { allowed: boolean; summary: string }) {
  const supplier = await prisma.supplier.upsert({
    where: { slug: 'caracal-tech-motors' },
    update: {
      name: 'Caracal Tech Motors',
      websiteUrl: 'https://caracaltechmotors.com',
      metadata: { source: 'owned-brand' },
    },
    create: {
      name: 'Caracal Tech Motors',
      slug: 'caracal-tech-motors',
      websiteUrl: 'https://caracaltechmotors.com',
      metadata: { source: 'owned-brand' },
    },
  });

  return prisma.supplierSource.upsert({
    where: { slug: source.slug },
    update: {
      supplierId: supplier.id,
      name: source.name,
      baseUrl: source.baseUrl,
      currency: source.currency,
      scrapeAllowed: robots.allowed,
      robotsSummary: robots.summary,
      metadata: toJson({
        connectorType: source.connectorType,
        supplierTerms: source.supplierTerms,
        productPathHints: source.productPathHints,
        discoveryPaths: source.discoveryPaths,
        weakSkuTerms: source.weakSkuTerms,
      }),
    },
    create: {
      supplierId: supplier.id,
      slug: source.slug,
      name: source.name,
      baseUrl: source.baseUrl,
      currency: source.currency,
      scrapeAllowed: robots.allowed,
      robotsSummary: robots.summary,
      metadata: toJson({
        connectorType: source.connectorType,
        supplierTerms: source.supplierTerms,
        productPathHints: source.productPathHints,
        discoveryPaths: source.discoveryPaths,
        weakSkuTerms: source.weakSkuTerms,
      }),
    },
  });
}

function categorySlugFor(product: NormalizedProduct): { slug: string; name: string } {
  const text = `${product.normalizedName} ${product.brand ?? ''} ${product.categoryName ?? ''}`.toLowerCase();

  if (/cable|adapter|connector|harness|bench\s*lead/.test(text)) {
    return { slug: 'cables-adapters', name: 'Cables & Adapters' };
  }
  if (/key|immo|immobilizer|remote|transponder|xhorse|vvdi|yanhua|autel im/.test(text)) {
    return { slug: 'key-programming', name: 'Key Programming' };
  }
  if (/scanner|diagnostic|launch|autel|topdon|thinkdiag|obdstar|x431/.test(text)) {
    return { slug: 'diagnostic-tools', name: 'Diagnostic Tools' };
  }
  if (/course|training|subscription|token|license|software/.test(text)) {
    return { slug: 'services', name: 'Services' };
  }

  return { slug: 'tuning-tools', name: 'Tuning Tools' };
}

async function publishProduct(
  source: SourceConfig,
  sourceRowId: string,
  product: NormalizedProduct
): Promise<string | null> {
  if (product.status !== 'READY') {
    return null;
  }
  if (product.salePriceCents === null || product.oldPriceCents === null) {
    return null;
  }

  const supplier = await prisma.supplier.upsert({
    where: { slug: 'caracal-tech-motors' },
    update: { name: 'Caracal Tech Motors' },
    create: {
      name: 'Caracal Tech Motors',
      slug: 'caracal-tech-motors',
      websiteUrl: 'https://caracaltechmotors.com',
      metadata: { source: 'owned-brand' },
    },
  });
  const mappedCategory = categorySlugFor(product);
  const category = await prisma.category.upsert({
    where: { slug: mappedCategory.slug },
    update: { name: mappedCategory.name, isActive: true },
    create: {
      name: mappedCategory.name,
      slug: mappedCategory.slug,
      isActive: true,
      metadata: { source: 'supplier-sync' },
    },
  });
  const existingSnapshot = await prisma.stagingProduct.findUnique({
    where: {
      sourceId_sourceProductKey: {
        sourceId: sourceRowId,
        sourceProductKey: product.sourceProductKey,
      },
    },
    select: { matchedProductId: true },
  });
  const sku = existingSnapshot?.matchedProductId
    ? undefined
    : `CTM-${hash(product.sourceProductKey, 10).toUpperCase()}`;
  const slugBase = slugify(product.normalizedName) || `supplier-product-${hash(product.sourceProductKey, 8)}`;
  const slug = `${slugBase}-${hash(product.sourceProductKey, 6)}`;
  const attributes = {
    inquiryReady: true,
    salePriceCents: product.salePriceCents,
    oldPriceCents: product.oldPriceCents,
    saleDiscountPercent: 10,
  };
  const metadata = {
    source: 'supplier-sync',
    sourceProductKey: product.sourceProductKey,
    externalSku: product.externalSku,
    externalUrl: product.externalUrl,
    sourceSlug: source.slug,
    sourceName: source.name,
    rawCurrency: product.currency,
    rawPriceCents: product.priceCents,
    convertedPriceCents: product.convertedPriceCents,
    marginPercent: 15,
    discountPercent: 10,
    warnings: product.warnings,
    imageUrlRejectedForBrandReview: product.imageUrl,
  };

  const published = await prisma.product.upsert({
    where: existingSnapshot?.matchedProductId
      ? { id: existingSnapshot.matchedProductId }
      : { sku: sku ?? `CTM-${hash(product.sourceProductKey, 10).toUpperCase()}` },
    update: {
      name: product.normalizedName,
      shortDescription: product.shortDescription,
      description: product.description,
      status: 'ACTIVE',
      priceCents: product.salePriceCents,
      currency: TARGET_CURRENCY,
      tradePriceCents: null,
      categoryId: category.id,
      supplierId: supplier.id,
      isB2BEligible: true,
      isTradeOnly: false,
      attributes,
      metadata,
      publishedAt: new Date(),
    },
    create: {
      sku: sku ?? `CTM-${hash(product.sourceProductKey, 10).toUpperCase()}`,
      slug,
      name: product.normalizedName,
      shortDescription: product.shortDescription,
      description: product.description,
      status: 'ACTIVE',
      priceCents: product.salePriceCents,
      currency: TARGET_CURRENCY,
      tradePriceCents: null,
      categoryId: category.id,
      supplierId: supplier.id,
      isB2BEligible: true,
      isTradeOnly: false,
      attributes,
      metadata,
      publishedAt: new Date(),
    },
  });

  await prisma.inventoryItem.upsert({
    where: {
      productId_locationKey: {
        productId: published.id,
        locationKey: 'supplier-sync',
      },
    },
    update: {
      locationLabel: 'Supplier monitored availability',
      quantityOnHand: product.stockStatus === 'OUT_OF_STOCK' || product.stockStatus === 'DISCONTINUED' ? 0 : 1,
      quantityReserved: 0,
      reorderPoint: 0,
      status: product.stockStatus,
      metadata: { source: 'supplier-sync' },
    },
    create: {
      productId: published.id,
      locationKey: 'supplier-sync',
      locationLabel: 'Supplier monitored availability',
      quantityOnHand: product.stockStatus === 'OUT_OF_STOCK' || product.stockStatus === 'DISCONTINUED' ? 0 : 1,
      quantityReserved: 0,
      reorderPoint: 0,
      status: product.stockStatus,
      metadata: { source: 'supplier-sync' },
    },
  });

  await prisma.stagingProduct.update({
    where: {
      sourceId_sourceProductKey: {
        sourceId: sourceRowId,
        sourceProductKey: product.sourceProductKey,
      },
    },
    data: { matchedProductId: published.id },
  });

  return published.id;
}

async function stageSnapshot(
  sourceRowId: string,
  runId: string,
  product: NormalizedProduct
) {
  return prisma.stagingProduct.upsert({
    where: {
      sourceId_sourceProductKey: {
        sourceId: sourceRowId,
        sourceProductKey: product.sourceProductKey,
      },
    },
    update: {
      runId,
      externalUrl: product.externalUrl,
      externalSku: product.externalSku,
      normalizedSku: product.normalizedSku,
      externalName: product.name,
      normalizedName: product.normalizedName,
      brand: product.brand,
      categoryName: product.categoryName,
      rawPriceCents: product.priceCents,
      rawCurrency: product.currency,
      convertedPriceCents: product.convertedPriceCents,
      salePriceCents: product.salePriceCents,
      oldPriceCents: product.oldPriceCents,
      stockStatus: product.stockStatus,
      imageUrl: product.imageUrl,
      imageApproved: product.imageApproved,
      status: product.status,
      warnings: toJson(product.warnings),
      rejectReasons: toJson(product.rejectReasons),
      rawData: product.rawData,
      normalizedData: toJson({
        description: product.description,
        shortDescription: product.shortDescription,
        pricingRule: 'sale = supplier AED price * 1.15; oldPrice = sale / 0.90',
      }),
      lastSeenAt: new Date(),
    },
    create: {
      sourceId: sourceRowId,
      runId,
      sourceProductKey: product.sourceProductKey,
      externalUrl: product.externalUrl,
      externalSku: product.externalSku,
      normalizedSku: product.normalizedSku,
      externalName: product.name,
      normalizedName: product.normalizedName,
      brand: product.brand,
      categoryName: product.categoryName,
      rawPriceCents: product.priceCents,
      rawCurrency: product.currency,
      convertedPriceCents: product.convertedPriceCents,
      salePriceCents: product.salePriceCents,
      oldPriceCents: product.oldPriceCents,
      stockStatus: product.stockStatus,
      imageUrl: product.imageUrl,
      imageApproved: product.imageApproved,
      status: product.status,
      warnings: toJson(product.warnings),
      rejectReasons: toJson(product.rejectReasons),
      rawData: product.rawData,
      normalizedData: toJson({
        description: product.description,
        shortDescription: product.shortDescription,
        pricingRule: 'sale = supplier AED price * 1.15; oldPrice = sale / 0.90',
      }),
    },
  });
}

async function syncSource(source: SourceConfig, options: CliOptions) {
  const robots = options.skipRobots
    ? { allowed: true, summary: 'robots.txt skipped by operator' }
    : await getRobotsSummary(source);
  const runStartedAt = new Date();
  const sourceRow =
    options.mode === 'DRY_RUN' ? null : await upsertSource(source, robots);
  const run =
    sourceRow && options.mode !== 'DRY_RUN'
      ? await prisma.supplierSyncRun.create({
          data: {
            sourceId: sourceRow.id,
            mode: options.mode,
            status: 'RUNNING',
            metadata: toJson({ limit: options.limit, userAgent: USER_AGENT, robots }),
          },
        })
      : null;

  try {
    if (!robots.allowed) {
      throw new Error(`robots.txt blocks broad crawling for ${source.name}; source skipped`);
    }

    const urls = await discoverProductUrls(source, options.limit);
    const parsed: NormalizedProduct[] = [];
    const parsedKeys = new Set<string>();

    for (const [index, url] of urls.entries()) {
      if (index > 0 && options.delayMs > 0) {
        await sleep(options.delayMs);
      }
      const raw = await parseProductPage(source, url);
      if (!raw) continue;

      const normalized = normalizeProduct(source, raw);
      if (parsedKeys.has(normalized.sourceProductKey)) {
        continue;
      }
      parsedKeys.add(normalized.sourceProductKey);
      parsed.push(normalized);
    }

    let publishedCount = 0;
    if (sourceRow && run) {
      for (const product of parsed) {
        await stageSnapshot(sourceRow.id, run.id, product);
        if (options.mode === 'PUBLISH') {
          const publishedId = await publishProduct(source, sourceRow.id, product);
          if (publishedId) publishedCount += 1;
        }
      }

      await prisma.supplierSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          discoveredCount: urls.length,
          stagedCount: parsed.length,
          acceptedCount: parsed.filter((product) => product.status === 'READY').length,
          reviewCount: parsed.filter((product) => product.status === 'PENDING').length,
          rejectedCount: parsed.filter((product) => product.status === 'REJECTED').length,
          publishedCount,
        },
      });
    }

    return {
      source: source.slug,
      connectorType: source.connectorType,
      mode: options.mode,
      startedAt: runStartedAt.toISOString(),
      discovered: urls.length,
      parsed: parsed.length,
      accepted: parsed.filter((product) => product.status === 'READY').length,
      review: parsed.filter((product) => product.status === 'PENDING').length,
      rejected: parsed.filter((product) => product.status === 'REJECTED').length,
      published: publishedCount,
      sample: parsed.slice(0, 5).map((product) => ({
        name: product.normalizedName,
        sku: product.normalizedSku,
        rawPriceCents: product.priceCents,
        rawCurrency: product.currency,
        salePriceCents: product.salePriceCents,
        oldPriceCents: product.oldPriceCents,
        status: product.status,
        warnings: product.warnings,
        rejectReasons: product.rejectReasons,
      })),
    };
  } catch (error) {
    if (run) {
      await prisma.supplierSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }

    throw error;
  }
}

async function main() {
  const options = parseOptions();
  const selectedSources = SOURCE_CONNECTORS.filter((source) => options.sources.includes(source.slug));
  if (selectedSources.length === 0) {
    throw new Error(`No matching sources. Available: ${SOURCE_CONNECTORS.map((source) => source.slug).join(', ')}`);
  }

  const reports = [];
  for (const source of selectedSources) {
    try {
      reports.push(await syncSource(source, options));
    } catch (error) {
      reports.push({
        source: source.slug,
        mode: options.mode,
        connectorType: source.connectorType,
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(JSON.stringify({ mode: options.mode, reports }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
