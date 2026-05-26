import { getPrismaClient } from '@caracal/db';

import { logger } from '../logger.js';
import { deleteTypesenseProduct, upsertTypesenseProduct } from './typesense.js';

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

function buildTypesenseDocument(row: PublicProductProjectionRow) {
  return {
    id: row.public_id,
    public_id: row.public_id,
    slug: row.slug,
    name: row.name,
    short_description: row.short_description,
    manufacturer_slug: row.manufacturer_slug,
    manufacturer_name: row.manufacturer_name,
    category_slug: row.category_slug,
    category_path: [row.category_slug],
    tags: [],
    compatibility: [],
    best_price_cents: toNumber(row.best_price_cents),
    in_stock: row.in_stock,
    offer_count: row.offer_count,
    featured: row.featured,
    published_at: publishedAtEpochSeconds(row.published_at),
    primary_image_key: parsePrimaryImageKey(row.primary_image),
  };
}

export async function refreshPublicProductsMaterializedView(): Promise<void> {
  const prisma = getPrismaClient();

  try {
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY public_products');
  } catch (error) {
    logger.warn({ err: error }, 'concurrent public_products refresh failed; retrying non-concurrently');
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW public_products');
  }
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
    await refreshPublicProductsMaterializedView();
    projection = await findPublicProjection(master.publicId);
  }

  if (!projection) {
    await deleteTypesenseProduct(master.publicId);
    return { action: 'delete-missing-projection' as const, publicId: master.publicId };
  }

  await upsertTypesenseProduct(buildTypesenseDocument(projection));
  return { action: 'upsert' as const, publicId: master.publicId };
}
