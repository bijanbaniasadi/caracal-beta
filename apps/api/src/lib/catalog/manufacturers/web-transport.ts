/**
 * Shared HTTP transport for manufacturer fetchers (M2a).
 *
 * Try a plain `fetch()` first. If the response is 4xx that smells like a bot
 * wall (403, 429, 503, or a 200 with a Cloudflare interstitial), fall back to
 * the Bright Data Web Unlocker proxy when BRIGHTDATA_API_KEY is set. M2a is
 * built for sites that don't need that fallback (autotuner.com, alientech-tools.com
 * are both directly fetchable from a normal IP); the helper exists so adding a
 * blocked source later doesn't ripple through every fetcher.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_USER_AGENT =
  'CaracalTechCatalogBot/1.0 (+https://new.caracaltechmotors.com; caracal-tech@caracal.local)';

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  url: string;
  body: string;
  contentType: string | null;
  via: 'direct' | 'bright-data';
}

export interface SafeFetchOptions {
  url: string;
  timeoutMs?: number;
  acceptHeader?: string;
}

function looksLikeBotWall(status: number, body: string): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  if (status === 200) {
    const head = body.slice(0, 4096);
    if (/just a moment\.\.\./i.test(head)) return true;
    if (/cf-browser-verification|__cf_chl_|cf-challenge/i.test(head)) return true;
  }
  return false;
}

async function directFetch(options: SafeFetchOptions): Promise<SafeFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(options.url, {
      headers: {
        'user-agent': DEFAULT_USER_AGENT,
        accept: options.acceptHeader ?? 'text/html,application/json,application/xhtml+xml,*/*;q=0.5',
        'accept-language': 'en',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      body,
      contentType: response.headers.get('content-type'),
      via: 'direct',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function brightDataFetch(options: SafeFetchOptions): Promise<SafeFetchResult | null> {
  const apiKey = process.env.BRIGHTDATA_API_KEY?.trim();
  if (!apiKey) return null;
  // Bright Data Web Unlocker REST endpoint. Returns the cleaned HTML body of
  // the requested URL with bot-detection bypass. Zone name defaults to
  // BRIGHTDATA_ZONE, falls back to 'web_unlocker' (a common default).
  const zone = process.env.BRIGHTDATA_ZONE?.trim() || 'web_unlocker';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json,text/html,*/*;q=0.5',
      },
      body: JSON.stringify({
        zone,
        url: options.url,
        format: 'raw',
      }),
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url: options.url,
      body,
      contentType: response.headers.get('content-type'),
      via: 'bright-data',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function safeFetch(options: SafeFetchOptions): Promise<SafeFetchResult> {
  const direct = await directFetch(options);
  if (direct.ok && !looksLikeBotWall(direct.status, direct.body)) return direct;
  const fallback = await brightDataFetch(options);
  if (fallback) return fallback;
  return direct;
}

export async function fetchBinary(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<{
  ok: boolean;
  status: number;
  bytes: Buffer | null;
  contentType: string | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'image/*,*/*;q=0.5' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, status: response.status, bytes: null, contentType: response.headers.get('content-type') };
    }
    const arrayBuffer = await response.arrayBuffer();
    return {
      ok: true,
      status: response.status,
      bytes: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type'),
    };
  } finally {
    clearTimeout(timer);
  }
}
