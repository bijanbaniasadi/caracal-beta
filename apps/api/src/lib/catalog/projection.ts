import { getPrismaClient } from '@caracal/db';

import { logger } from '../logger.js';
import {
  createTypesenseProductsCollection,
  deleteTypesenseCollection,
  deleteTypesenseProduct,
  getTypesenseAliasTarget,
  getTypesenseCollectionDocumentCount,
  getTypesenseConfig,
  importTypesenseProducts,
  timestampedProductsCollectionName,
  upsertTypesenseAlias,
  upsertTypesenseProduct,
} from './typesense.js';

interface PublicProductProjectionRow {
  public_id: string;
  slug: string;
  name: string;
  short_description: string | null;
  manufacturer_slug: string;
  manufacturer_name: string;
  category_slug: string;
  category_name: string;
  primary_image: unknown;
  best_price_cents: bigint | number | null;
  price_currency: string;
  sell_price_cents: bigint | number | null;
  compare_at_cents: bigint | number | null;
  discount_pct: number | null;
  sourcing_vendor_name: string | null;
  in_stock: boolean;
  offer_count: number;
  featured: boolean;
  published_at: Date | string | null;
}

function parsePrimaryImageKey(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const storageKey = (value as { storage_key?: unknown }).storage_key;
  return typeof storageKey === 'string' && storageKey.length > 0 ? storageKey : null;
}

function toNumber(value: bigint | number | null): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'bigint' ? Number(value) : value;
}

function publishedAtEpochSeconds(value: Date | string | null): number {
  if (!value) {
    return 0;
  }

  return Math.floor(new Date(value).getTime() / 1000);
}

export function buildTypesenseDocument(row: PublicProductProjectionRow) {
  return {
    id: row.public_id,
    public_id: row.public_id,
    slug: row.slug,
    name: row.name,
    short_description: row.short_description,
    manufacturer_slug: row.manufacturer_slug,
    manufacturer_name: row.manufacturer_name,
    category_slug: row.category_slug,
    category_name: row.category_name,
    category_path: [row.category_slug],
    tags: [],
    compatibility: [],
    best_price_cents: toNumber(row.best_price_cents),
    sell_price_cents: toNumber(row.sell_price_cents),
    compare_at_cents: toNumber(row.compare_at_cents),
    discount_pct: row.discount_pct,
    currency: row.price_currency,
    sourcing_vendor_name: row.sourcing_vendor_name,
    in_stock: row.in_stock,
    offer_count: row.offer_count,
    featured: row.featured,
    published_at: publishedAtEpochSeconds(row.published_at),
    primary_image_key: parsePrimaryImageKey(row.primary_image),
  };
}

function matviewRefreshDebounceMs(): number {
  return Number.parseInt(process.env.CATALOG_MATVIEW_REFRESH_DEBOUNCE_MS ?? '30000', 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastMatviewRefreshAt = 0;
let matviewRefreshPromise: Promise<void> | null = null;

export async function refreshPublicProductsMaterializedView(): Promise<void> {
  const prisma = getPrismaClient();

  try {
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY public_products');
  } catch (error) {
    logger.warn(
      { err: error },
      'concurrent public_products refresh failed; retrying non-concurrently'
    );
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW public_products');
  }
}

export async function refreshPublicProductsMaterializedViewDebounced(): Promise<{
  action: 'refresh-matview';
  debouncedMs: number;
}> {
  if (matviewRefreshPromise) {
    await matviewRefreshPromise;
    return { action: 'refresh-matview', debouncedMs: 0 };
  }

  const elapsed = Date.now() - lastMatviewRefreshAt;
  const waitMs = Math.max(matviewRefreshDebounceMs() - elapsed, 0);

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  if (matviewRefreshPromise) {
    await matviewRefreshPromise;
    return { action: 'refresh-matview', debouncedMs: waitMs };
  }

  matviewRefreshPromise = refreshPublicProductsMaterializedView().finally(() => {
    lastMatviewRefreshAt = Date.now();
    matviewRefreshPromise = null;
  });

  await matviewRefreshPromise;
  return { action: 'refresh-matview', debouncedMs: waitMs };
}

async function findPublicProjection(publicId: string): Promise<PublicProductProjectionRow | null> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw<PublicProductProjectionRow[]>`
    SELECT
      public_id::text,
      slug::text,
      name,
      short_description,
      manufacturer_slug::text,
      manufacturer_name,
      category_slug::text,
      category_name,
      primary_image,
      best_price_cents,
      price_currency,
      sell_price_cents,
      compare_at_cents,
      discount_pct,
      sourcing_vendor_name,
      in_stock,
      offer_count,
      featured,
      published_at
    FROM public_products
    WHERE public_id = ${publicId}::uuid
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function findAllPublicProjections(): Promise<PublicProductProjectionRow[]> {
  const prisma = getPrismaClient();

  return prisma.$queryRaw<PublicProductProjectionRow[]>`
    SELECT
      public_id::text,
      slug::text,
      name,
      short_description,
      manufacturer_slug::text,
      manufacturer_name,
      category_slug::text,
      category_name,
      primary_image,
      best_price_cents,
      price_currency,
      sell_price_cents,
      compare_at_cents,
      discount_pct,
      sourcing_vendor_name,
      in_stock,
      offer_count,
      featured,
      published_at
    FROM public_products
    ORDER BY published_at DESC NULLS LAST, public_id
  `;
}

export async function projectMasterProductToSearch(masterProductId: string) {
  const prisma = getPrismaClient();
  const productId = BigInt(masterProductId);
  const master = await prisma.masterProduct.findUnique({
    where: { id: productId },
    select: {
      publicId: true,
      status: true,
    },
  });

  if (!master) {
    logger.warn({ masterProductId }, 'master product missing during projection');
    return { action: 'missing' as const };
  }

  if (master.status !== 'PUBLISHED') {
    await deleteTypesenseProduct(master.publicId);
    return { action: 'delete' as const, publicId: master.publicId };
  }

  let projection = await findPublicProjection(master.publicId);

  if (!projection) {
    await refreshPublicProductsMaterializedViewDebounced();
    projection = await findPublicProjection(master.publicId);
  }

  if (!projection) {
    await deleteTypesenseProduct(master.publicId);
    return { action: 'delete-missing-projection' as const, publicId: master.publicId };
  }

  await upsertTypesenseProduct(buildTypesenseDocument(projection));
  logger.info(
    { publicId: master.publicId, masterProductId },
    'catalog projection product indexed via Typesense alias'
  );
  return { action: 'upsert' as const, publicId: master.publicId };
}

export async function reindexAllPublicProductsWithAliasSwap() {
  await refreshPublicProductsMaterializedViewDebounced();

  const config = getTypesenseConfig();
  const previousCollection = await getTypesenseAliasTarget(config.collectionAlias, config).catch(
    (error) => {
      logger.warn(
        { err: error, alias: config.collectionAlias },
        'Typesense alias lookup failed before reindex'
      );
      return null;
    }
  );
  const nextCollection = timestampedProductsCollectionName(config);
  const projections = await findAllPublicProjections();
  const documents = projections.map(buildTypesenseDocument);

  await createTypesenseProductsCollection(nextCollection, config);
  await importTypesenseProducts(nextCollection, documents, config);

  const indexedCount = await getTypesenseCollectionDocumentCount(nextCollection, config);
  if (indexedCount !== documents.length) {
    throw new Error(
      `Typesense alias-swap validation failed: expected ${documents.length} documents in ${nextCollection}, found ${indexedCount}`
    );
  }

  await upsertTypesenseAlias(config.collectionAlias, nextCollection, config);
  logger.info(
    {
      alias: config.collectionAlias,
      nextCollection,
      previousCollection,
      postgresCount: documents.length,
      indexedCount,
    },
    'catalog projection alias-swap reindex completed'
  );

  if (previousCollection && previousCollection !== nextCollection) {
    await deleteTypesenseCollection(previousCollection, config);
  }

  return {
    action: 'alias-swap-reindex' as const,
    alias: config.collectionAlias,
    previousCollection,
    nextCollection,
    postgresCount: documents.length,
    indexedCount,
  };
}
