/**
 * Alientech manufacturer content fetcher (M2a).
 *
 * alientech-tools.com is a WordPress site that sells only through dealers, so
 * there are NO public prices. We pull:
 *   - canonical name from og:title / <title>
 *   - description from og:description (short) + meta-description (richer if present)
 *   - images from og:image and inline product imagery
 * RRP is always null for Alientech products — A3.1 correctly leaves compare-at
 * blank, which is honest (we don't fabricate a discount when no RRP is published).
 *
 * Confidence caps at 0.75 because of the missing price signal; that's by design.
 */
import type {
  ManufacturerFetcher,
  ManufacturerFetcherInput,
  ManufacturerProductContent,
} from './types.js';
import { safeFetch } from './web-transport.js';

const BASE_URL = 'https://www.alientech-tools.com';

function extractMeta(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${escape(key)}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+property=["']${escape(key)}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return decodeEntities(match[1]).trim();
  }
  return null;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractH1Description(html: string): string {
  // Pull the marketing paragraph immediately after the product H1 (KESS3 page
  // structure). Falls back to a slice of the body text if no H1 region is found.
  const h1Section =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>([\s\S]*?)(?=<h2|<\/section|<\/main)/i) ?? null;
  const candidate = h1Section?.[2] ?? html.slice(0, 4000);
  return candidate
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .split('\n\n')
    .slice(0, 6)
    .join('\n\n');
}

function extractImages(html: string, ogImage: string | null): string[] {
  const urls = new Set<string>();
  if (ogImage) urls.add(ogImage);

  // Look for product imagery from Alientech's WP upload directory. Skip flag
  // icons, decorative SVGs, plugin assets.
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgPattern.exec(html))) {
    const src = match[1];
    if (!/^https?:/i.test(src)) continue;
    if (!src.includes('alientech-tools.com')) continue;
    if (/\/plugins\//i.test(src)) continue;
    if (/\.svg(\?|$)/i.test(src)) continue;
    if (/cropped-favicon|flags|wpml|cropped-/i.test(src)) continue;
    // Prefer larger sized variants (Alientech serves -1024x, -870x, -800x crops).
    urls.add(src);
    if (urls.size >= 6) break;
  }
  return Array.from(urls).slice(0, 6);
}

function scoreConfidence(name: string, description: string, imageCount: number): number {
  let score = 0;
  if (name.trim().length > 3) score += 0.25;
  if (description.trim().length > 200) score += 0.25;
  if (imageCount > 0) score += 0.25;
  // Cap at 0.75 — RRP is always null for Alientech (dealer-only pricing).
  return score;
}

export class AlientechFetcher implements ManufacturerFetcher {
  readonly brandSlug = 'alientech';
  readonly brandName = 'Alientech';

  async fetch(input: ManufacturerFetcherInput): Promise<ManufacturerProductContent> {
    const path = input.handle.replace(/^\/?|\/?$/g, '/');
    const sourceUrl = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

    const response = await safeFetch({ url: sourceUrl, acceptHeader: 'text/html' });
    if (!response.ok) {
      throw new Error(`Alientech fetch failed: ${response.status} for ${sourceUrl} (via ${response.via})`);
    }
    const html = response.body;
    if (!html || html.length < 500) {
      throw new Error(`Alientech fetch returned empty body for ${sourceUrl}`);
    }

    const canonicalName =
      extractMeta(html, 'og:title')?.split('|')[0].trim() ??
      (html.match(/<title>([^<]+)<\/title>/i)?.[1].split('|')[0].trim() ?? 'Alientech product');

    const ogImage = extractMeta(html, 'og:image');
    const ogDescription = extractMeta(html, 'og:description') ?? '';
    const longBody = extractH1Description(html);
    const description = [ogDescription, longBody].filter(Boolean).join('\n\n').trim();

    const images = extractImages(html, ogImage).map((url, index) => ({
      sourceUrl: url,
      isPrimary: index === 0,
      width: null,
      height: null,
      altText: index === 0 ? canonicalName : null,
    }));

    return {
      canonicalName,
      description,
      rrp: null,
      images,
      specs: { vendor: 'Alientech', dealerOnlyPricing: 'true' },
      variants: input.variantTitle ? [{ name: input.variantTitle }] : [],
      confidence: scoreConfidence(canonicalName, description, images.length),
      sourceUrl,
    };
  }
}
