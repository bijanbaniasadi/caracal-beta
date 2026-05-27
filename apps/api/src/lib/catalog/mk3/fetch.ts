import { readFile } from 'node:fs/promises';

import { writeCatalogRawAsset } from '../object-storage.js';
import { logger } from '../../logger.js';
import { extractMk3ProductsFromHtml, type Mk3ExtractedProduct } from './extract.js';

export interface Mk3FetchedPage {
  url: string;
  html: string;
  rawHtmlStorageKey: string | null;
  products: Mk3ExtractedProduct[];
}

export interface Mk3DiscoveryOptions {
  baseUrl: string;
  startUrls?: string[];
  maxPages?: number;
  limit?: number;
  fullCrawl?: boolean;
  fixturePath?: string;
}

const defaultUserAgent =
  'CaracalTechMotorsCatalogBot/1.0 (+https://caracaltechmotors.com; staged catalog ingestion)';
const defaultBoundedLimit = 10;
const maxBoundedLimit = 20;
const defaultRequestDelayMs = 1000;

class RetryableMk3FetchError extends Error {}

export class Mk3BotProtectionError extends Error {
  constructor(url: string, status: number) {
    super(`MK3 appears to be blocking automated access for ${url} (${status}); stopping crawl.`);
    this.name = 'Mk3BotProtectionError';
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mk3UserAgent(): string {
  return process.env.MK3_INGESTION_USER_AGENT ?? defaultUserAgent;
}

function retryAttempts(): number {
  return Math.max(1, Number.parseInt(process.env.MK3_INGESTION_RETRY_ATTEMPTS ?? '3', 10));
}

function requestDelayMs(): number {
  return Math.max(
    0,
    Number.parseInt(process.env.MK3_INGESTION_REQUEST_DELAY_MS ?? `${defaultRequestDelayMs}`, 10)
  );
}

function boundedLimit(options: Mk3DiscoveryOptions): number {
  const envLimit = Number.parseInt(process.env.MK3_INGESTION_LIMIT ?? `${defaultBoundedLimit}`, 10);
  const requested = Math.max(1, options.limit ?? envLimit);

  if (options.fullCrawl) {
    return requested;
  }

  return Math.min(requested, maxBoundedLimit);
}

function looksLikeBotWall(status: number, body: string): boolean {
  const text = body.slice(0, 5000).toLowerCase();

  return (
    status === 403 ||
    text.includes('cloudflare') ||
    text.includes('captcha') ||
    text.includes('attention required') ||
    text.includes('access denied')
  );
}

async function fetchTextWithRetry(url: string, attempts = retryAttempts()): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': mk3UserAgent(),
        },
      });
      const body = await response.text();

      if (looksLikeBotWall(response.status, body)) {
        throw new Mk3BotProtectionError(url, response.status);
      }

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new RetryableMk3FetchError(`MK3 fetch failed for ${url}: ${response.status}`);
        }

        throw new Error(`MK3 fetch failed for ${url}: ${response.status}`);
      }

      return body;
    } catch (error) {
      if (error instanceof Mk3BotProtectionError) throw error;

      lastError = error;
      if (attempt < attempts) {
        await sleep(750 * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`MK3 fetch failed for ${url}`);
}

function defaultStartUrls(baseUrl: string): string[] {
  return [new URL('/autotuner-tool', baseUrl).toString()];
}

function sameOriginUrl(input: string, baseUrl: string): string {
  const absolute = new URL(input, baseUrl);
  const base = new URL(baseUrl);

  if (absolute.origin !== base.origin) {
    throw new Error(`MK3 crawl refused off-origin URL: ${absolute.toString()}`);
  }

  return absolute.toString();
}

function extractedFromProductPage(products: Mk3ExtractedProduct[]): boolean {
  return products.some((product) => {
    const source =
      product.rawSpecs && typeof product.rawSpecs.source === 'string'
        ? product.rawSpecs.source
        : null;
    return source === 'json-ld' || source === 'product-page-fallback';
  });
}

function robotsPatternMatches(path: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\\\$$/, '$');
  return new RegExp(`^${escaped}`).test(path);
}

export function isMk3PathAllowedByRobots(
  robotsText: string,
  userAgent: string,
  targetUrl: string
): boolean {
  const path = `${new URL(targetUrl).pathname}${new URL(targetUrl).search}`;
  const crawler = userAgent.split(/[ /]/)[0]?.toLowerCase() ?? userAgent.toLowerCase();
  const rules: Array<{ type: 'allow' | 'disallow'; value: string }> = [];
  let activeAgents: string[] = [];

  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();

    if (!line) {
      activeAgents = [];
      continue;
    }

    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'user-agent') {
      activeAgents.push(value.toLowerCase());
      continue;
    }

    if (key !== 'allow' && key !== 'disallow') continue;

    const applies = activeAgents.some((agent) => agent === '*' || crawler.includes(agent));
    if (applies) {
      rules.push({ type: key, value });
    }
  }

  const matches = rules
    .filter((rule) => rule.value.length > 0 && robotsPatternMatches(path, rule.value))
    .sort((a, b) => b.value.length - a.value.length);

  return matches[0]?.type !== 'disallow';
}

function parseDataImageUrl(originalUrl: string): {
  bytes: Buffer;
  mimeType: string;
  extension: string;
} | null {
  const match = originalUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const extension = mimeType.split('/')[1]?.split('+')[0] ?? 'img';

  return {
    bytes: Buffer.from(match[2], 'base64'),
    mimeType,
    extension,
  };
}

export async function downloadMk3Image(originalUrl: string): Promise<{
  storageKey: string;
  contentHash: string;
  bytes: number;
  mimeType: string | null;
}> {
  const dataImage = parseDataImageUrl(originalUrl);
  if (dataImage) {
    const stored = await writeCatalogRawAsset('mk3-images', dataImage.bytes, dataImage.extension);

    return {
      storageKey: stored.storageKey,
      contentHash: stored.sha256,
      bytes: stored.bytes,
      mimeType: dataImage.mimeType,
    };
  }

  const response = await fetch(originalUrl, {
    headers: {
      accept: 'image/avif,image/webp,image/png,image/jpeg,image/*',
      'user-agent': mk3UserAgent(),
    },
  });

  if (!response.ok) {
    throw new Error(`MK3 image download failed for ${originalUrl}: ${response.status}`);
  }

  const mimeType = response.headers.get('content-type');
  const extension = mimeType?.split('/')[1]?.split(';')[0] ?? 'img';
  const bytes = Buffer.from(await response.arrayBuffer());
  const stored = await writeCatalogRawAsset('mk3-images', bytes, extension);

  return {
    storageKey: stored.storageKey,
    contentHash: stored.sha256,
    bytes: stored.bytes,
    mimeType,
  };
}

function limitFetchedProducts(pages: Mk3FetchedPage[], limit: number): Mk3FetchedPage[] {
  let remaining = limit;
  const limited: Mk3FetchedPage[] = [];

  for (const page of pages) {
    if (remaining <= 0) break;
    const products = page.products.slice(0, remaining);
    remaining -= products.length;
    limited.push({ ...page, products });
  }

  return limited.filter((page) => page.products.length > 0);
}

async function readFixture(
  path: string,
  baseUrl: string,
  limit: number
): Promise<Mk3FetchedPage[]> {
  const content = await readFile(path, 'utf8');
  const parsed = JSON.parse(content) as { pages?: Array<{ url: string; html: string }> };
  const pages = parsed.pages ?? [];

  return limitFetchedProducts(
    pages.map((page) => ({
      url: page.url,
      html: page.html,
      rawHtmlStorageKey: null,
      products: extractMk3ProductsFromHtml(page.html, page.url, baseUrl),
    })),
    limit
  );
}

async function readRobots(baseUrl: string): Promise<string | null> {
  const robotsUrl = new URL('/robots.txt', baseUrl).toString();
  const response = await fetch(robotsUrl, {
    headers: {
      accept: 'text/plain,*/*',
      'user-agent': mk3UserAgent(),
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`MK3 robots.txt fetch failed: ${response.status}`);
  }

  return response.text();
}

export async function discoverMk3Products(options: Mk3DiscoveryOptions): Promise<Mk3FetchedPage[]> {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const fixturePath = options.fixturePath ?? process.env.MK3_INGESTION_FIXTURE_PATH;
  const limit = boundedLimit(options);

  if (fixturePath) {
    return readFixture(fixturePath, baseUrl, limit);
  }

  const startUrls =
    options.startUrls && options.startUrls.length > 0
      ? options.startUrls
      : defaultStartUrls(baseUrl);
  const maxPages = Math.max(
    1,
    options.maxPages ?? Number.parseInt(process.env.MK3_INGESTION_MAX_PAGES ?? '1', 10)
  );
  const robots = await readRobots(baseUrl);
  const pages: Mk3FetchedPage[] = [];
  const productUrls: string[] = [];
  const seenProductUrls = new Set<string>();
  let successfulRequests = 0;

  async function fetchAllowed(url: string): Promise<string> {
    if (robots && !isMk3PathAllowedByRobots(robots, mk3UserAgent(), url)) {
      throw new Error(`MK3 robots.txt disallows crawling ${url}`);
    }

    if (successfulRequests > 0) {
      await sleep(requestDelayMs());
    }
    successfulRequests += 1;

    return fetchTextWithRetry(url);
  }

  function queueProductUrl(url: string): void {
    const absoluteUrl = sameOriginUrl(url, baseUrl);
    if (!seenProductUrls.has(absoluteUrl)) {
      seenProductUrls.add(absoluteUrl);
      productUrls.push(absoluteUrl);
    }
  }

  for (const url of startUrls.slice(0, maxPages)) {
    const absoluteUrl = sameOriginUrl(url, baseUrl);
    const html = await fetchAllowed(absoluteUrl);
    const products = extractMk3ProductsFromHtml(html, absoluteUrl, baseUrl);

    if (extractedFromProductPage(products)) {
      pages.push({ url: absoluteUrl, html, rawHtmlStorageKey: null, products });
    } else {
      for (const product of products) {
        queueProductUrl(product.vendorUrl);
      }
    }
  }

  for (const productUrl of productUrls.slice(0, Math.max(0, limit - pages.length))) {
    const html = await fetchAllowed(productUrl);
    const products = extractMk3ProductsFromHtml(html, productUrl, baseUrl);

    pages.push({ url: productUrl, html, rawHtmlStorageKey: null, products });
  }

  if (pages.length === 0) {
    logger.warn(
      { startUrls, maxPages, limit },
      'MK3 live crawl found no product pages; site structure or bot protection may have changed'
    );
  }

  return limitFetchedProducts(pages, limit);
}
