import { getPrismaClient } from '@caracal/db';

import {
  getTypesenseAliasTarget,
  getTypesenseCollectionDocumentCount,
  getTypesenseConfig,
} from './typesense.js';

export interface ProjectionRuntimeCheck {
  name: string;
  ok: boolean;
  details?: unknown;
}

export interface ProjectionRuntimeHealth {
  ok: boolean;
  checks: ProjectionRuntimeCheck[];
}

function imageUrlFromStorageKey(storageKey: unknown): string | null {
  if (typeof storageKey !== 'string' || !storageKey.trim()) return null;
  if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) return storageKey;
  const publicBase = process.env.CATALOG_IMAGE_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (publicBase && !storageKey.startsWith('local://')) {
    return `${publicBase}/${storageKey.replace(/^\/+/, '')}`;
  }
  return null;
}

function storageKeyFromImage(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const storageKey = (value as { storage_key?: unknown }).storage_key;
  return typeof storageKey === 'string' && storageKey.trim() ? storageKey : null;
}

function staleWarnSeconds(): number {
  return Number.parseInt(process.env.CATALOG_PROJECTION_STALE_WARN_SECONDS ?? '300', 10);
}

export async function getProjectionRuntimeHealth(): Promise<ProjectionRuntimeHealth> {
  const prisma = getPrismaClient();
  const config = getTypesenseConfig();
  const checks: ProjectionRuntimeCheck[] = [];

  const projectionRows = await prisma.$queryRaw<
    Array<{
      count: bigint;
      sample_slug: string | null;
      latest_projected_at: Date | null;
    }>
  >`
    SELECT
      COUNT(*)::bigint AS count,
      MIN(slug::text) AS sample_slug,
      MAX(projected_at) AS latest_projected_at
    FROM public_products
  `;
  const projectionCount = Number(projectionRows[0]?.count ?? 0n);
  const sampleSlug = projectionRows[0]?.sample_slug ?? null;
  const latestProjectedAt = projectionRows[0]?.latest_projected_at ?? null;
  checks.push({
    name: 'public projection accessible',
    ok: true,
    details: { count: projectionCount },
  });
  checks.push({
    name: 'product slug valid',
    ok: sampleSlug === null || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sampleSlug),
    details: { sampleSlug },
  });

  const imageRows = await prisma.$queryRaw<Array<{ primary_image: unknown }>>`
    SELECT primary_image
    FROM public_products
    WHERE primary_image IS NOT NULL
    LIMIT 10
  `;
  const invalidImages = imageRows
    .map((row) => storageKeyFromImage(row.primary_image))
    .filter((storageKey): storageKey is string => Boolean(storageKey))
    .filter((storageKey) => imageUrlFromStorageKey(storageKey) === null);
  checks.push({
    name: 'image URLs valid',
    ok: invalidImages.length === 0,
    details: { checked: imageRows.length, invalid: invalidImages.length },
  });

  const sourceRows = await prisma.$queryRaw<Array<{ latest_source_update_at: Date | null }>>`
    SELECT MAX(updated_at) AS latest_source_update_at
    FROM master_products
    WHERE status = 'published'
  `;
  const latestSourceUpdateAt = sourceRows[0]?.latest_source_update_at ?? null;
  const staleAgeSeconds = latestProjectedAt
    ? Math.max(Math.floor((Date.now() - latestProjectedAt.getTime()) / 1000), 0)
    : null;
  const staleLimitSeconds = staleWarnSeconds();
  checks.push({
    name: 'projection stale-age',
    ok: projectionCount === 0 || (staleAgeSeconds !== null && staleAgeSeconds <= staleLimitSeconds),
    details: {
      latestProjectedAt,
      latestSourceUpdateAt,
      staleAgeSeconds,
      staleLimitSeconds,
    },
  });

  if (!config.apiKey) {
    checks.push({
      name: 'Typesense alias healthy',
      ok: false,
      details: { reason: 'TYPESENSE_API_KEY is not configured' },
    });
  } else {
    const [aliasTarget, indexedCount] = await Promise.all([
      getTypesenseAliasTarget(config.collectionAlias, config),
      getTypesenseCollectionDocumentCount(config.collectionAlias, config),
    ]);
    checks.push({
      name: 'Typesense alias healthy',
      ok: Boolean(aliasTarget),
      details: { alias: config.collectionAlias, aliasTarget, indexedCount },
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}
