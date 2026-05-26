import { readFile } from 'node:fs/promises';

import { writeCatalogRawAsset } from '../object-storage.js';
import { extractMk3ProductsFromHtml, type Mk3ExtractedProduct } from './extract.js';

export interface Mk3FetchedPage {
  url: string;
  html: string;
  rawHtmlStorageKey: string;
  products: Mk3ExtractedProduct[];
}

export interface Mk3DiscoveryOptions {
  baseUrl: string;
  startUrls?: string[];
  maxPages?: number;
  fixturePath?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTextWithRetry(url: string, attempts = 3): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': process.env.MK3_INGESTION_USER_AGENT ?? 'CaracalTechBot/0.1 staged-ingestion',
        },
      });

      if (!response.ok) {
        throw new Error(`MK3 fetch failed for ${url}: ${response.status}`);
      }

      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(500 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`MK3 fetch failed for ${url}`);
}

function defaultStartUrls(baseUrl: string): string[] {
  return [new URL('/collections/all', baseUrl).toString()];
}

function pageExtension(contentType: string | null): string {
  if (contentType?.includes('json')) return 'json';
  return 'html';
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
      'user-agent': process.env.MK3_INGESTION_USER_AGENT ?? 'CaracalTechBot/0.1 staged-ingestion',
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

async function readFixture(path: string, baseUrl: string): Promise<Mk3FetchedPage[]> {
  const content = await readFile(path, 'utf8');
  const parsed = JSON.parse(content) as { pages?: Array<{ url: string; html: string }> };
  const pages = parsed.pages ?? [];

  return Promise.all(
    pages.map(async (page) => {
      const stored = await writeCatalogRawAsset('mk3-html', page.html, 'html');
      return {
        url: page.url,
        html: page.html,
        rawHtmlStorageKey: stored.storageKey,
        products: extractMk3ProductsFromHtml(page.html, page.url, baseUrl),
      };
    })
  );
}

export async function discoverMk3Products(options: Mk3DiscoveryOptions): Promise<Mk3FetchedPage[]> {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const fixturePath = options.fixturePath ?? process.env.MK3_INGESTION_FIXTURE_PATH;

  if (fixturePath) {
    return readFixture(fixturePath, baseUrl);
  }

  const startUrls = options.startUrls && options.startUrls.length > 0 ? options.startUrls : defaultStartUrls(baseUrl);
  const maxPages = Math.max(1, options.maxPages ?? Number.parseInt(process.env.MK3_INGESTION_MAX_PAGES ?? '1', 10));
  const pages: Mk3FetchedPage[] = [];

  for (const url of startUrls.slice(0, maxPages)) {
    const absoluteUrl = new URL(url, baseUrl).toString();
    const html = await fetchTextWithRetry(absoluteUrl);
    const stored = await writeCatalogRawAsset(
      'mk3-html',
      html,
      pageExtension('text/html')
    );

    pages.push({
      url: absoluteUrl,
      html,
      rawHtmlStorageKey: stored.storageKey,
      products: extractMk3ProductsFromHtml(html, absoluteUrl, baseUrl),
    });
  }

  return pages;
}
