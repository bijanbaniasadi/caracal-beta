import { getPrismaClient } from '@caracal/db';
import { Prisma } from '@prisma/client';
import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { notFound } from '../lib/errors.js';
import {
  getTypesenseAliasTarget,
  getTypesenseCollectionDocumentCount,
  getTypesenseConfig,
  searchTypesenseProducts,
} from '../lib/catalog/typesense.js';

export const catalogProjectionRouter: ExpressRouter = Router();

const slug = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sort = z.enum(['featured', 'newest', 'name', 'price_asc', 'price_desc']).default('featured');
const listQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  category: slug.optional(),
  manufacturer: slug.optional(),
  inStock: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  sort,
});

interface PublicProjectionRow {
  public_id: string;
  slug: string;
  name: string;
  short_description: string | null;
  long_description_md: string | null;
  manufacturer_slug: string;
  manufacturer_name: string;
  category_slug: string;
  category_name: string;
  primary_image: unknown;
  gallery_images: unknown;
  best_price_cents: bigint | number | null;
  curated_price: unknown;
  in_stock: boolean;
  offer_count: number;
  vendor_offers: unknown;
  specs: unknown;
  compatibility: unknown;
  featured: boolean;
  published_at: Date | string | null;
}

function toNumber(value: bigint | number | null): number | null {
  if (value === null) return null;
  return typeof value === 'bigint' ? Number(value) : value;
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

function normalizeImage(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const storageKey = typeof item.storage_key === 'string' ? item.storage_key : null;

  return {
    storageKey,
    url: imageUrlFromStorageKey(storageKey),
    altText: typeof item.alt_text === 'string' ? item.alt_text : null,
    width: typeof item.width === 'number' ? item.width : null,
    height: typeof item.height === 'number' ? item.height : null,
    mimeType: typeof item.mime_type === 'string' ? item.mime_type : null,
    isPrimary: item.is_primary === true,
    sortOrder: typeof item.sort_order === 'number' ? item.sort_order : 0,
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatPrice(cents: number | null, currency = 'USD'): string | null {
  if (cents === null) return null;
  return `${currency} ${new Intl.NumberFormat('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)}`;
}

function normalizeCuratedPrice(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const rawPriceCents = item.price_cents;
  const cents = toNumber(
    typeof rawPriceCents === 'bigint' || typeof rawPriceCents === 'number' ? rawPriceCents : null
  );
  const currency = typeof item.currency === 'string' ? item.currency : 'USD';

  return {
    priceCents: cents,
    currency,
    formatted: formatPrice(cents, currency),
    selectedOfferId: typeof item.selected_offer_id === 'string' ? item.selected_offer_id : null,
    selectedAt: item.selected_at ?? null,
  };
}

function serializeProjection(row: PublicProjectionRow) {
  const bestPriceCents = toNumber(row.best_price_cents);
  const curatedPrice = normalizeCuratedPrice(row.curated_price);

  return {
    publicId: row.public_id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    longDescriptionMd: row.long_description_md,
    manufacturer: {
      slug: row.manufacturer_slug,
      name: row.manufacturer_name,
    },
    category: {
      slug: row.category_slug,
      name: row.category_name,
    },
    primaryImage: normalizeImage(row.primary_image),
    galleryImages: asArray(row.gallery_images).map(normalizeImage).filter(Boolean),
    bestPrice: {
      priceCents: bestPriceCents,
      currency: curatedPrice?.currency ?? 'USD',
      formatted: formatPrice(bestPriceCents, curatedPrice?.currency ?? 'USD'),
    },
    curatedPrice,
    inStock: row.in_stock,
    offerCount: row.offer_count,
    vendorOffers: asArray(row.vendor_offers).map((offer) => {
      const item = offer && typeof offer === 'object' ? (offer as Record<string, unknown>) : {};
      const rawPriceCents = item.price_cents;
      const priceCents = toNumber(
        typeof rawPriceCents === 'bigint' || typeof rawPriceCents === 'number'
          ? rawPriceCents
          : null
      );
      const currency = typeof item.currency === 'string' ? item.currency : 'USD';

      return {
        vendorName: typeof item.vendor_name === 'string' ? item.vendor_name : 'Vendor',
        priceCents,
        currency,
        formatted: formatPrice(priceCents, currency),
        inStock: item.in_stock === true,
        lastSeenAt: item.last_seen_at ?? null,
        confidence: typeof item.confidence === 'number' ? item.confidence : null,
      };
    }),
    specs: asArray(row.specs),
    compatibility: asArray(row.compatibility),
    featured: row.featured,
    publishedAt: row.published_at,
  };
}

function orderBySql(value: z.infer<typeof sort>) {
  if (value === 'newest') return Prisma.sql`published_at DESC NULLS LAST, public_id ASC`;
  if (value === 'name') return Prisma.sql`name ASC, public_id ASC`;
  if (value === 'price_asc') return Prisma.sql`best_price_cents ASC NULLS LAST, name ASC`;
  if (value === 'price_desc') return Prisma.sql`best_price_cents DESC NULLS LAST, name ASC`;
  return Prisma.sql`featured DESC, published_at DESC NULLS LAST, name ASC`;
}

function typeSenseSort(value: z.infer<typeof sort>): string | undefined {
  if (value === 'newest') return 'published_at:desc';
  if (value === 'price_asc') return 'best_price_cents:asc';
  if (value === 'price_desc') return 'best_price_cents:desc';
  if (value === 'featured') return 'featured:desc,published_at:desc';
  return undefined;
}

function buildWhere(query: z.infer<typeof listQuerySchema>) {
  const clauses: Prisma.Sql[] = [];

  if (query.category) clauses.push(Prisma.sql`category_slug = ${query.category}::citext`);
  if (query.manufacturer)
    clauses.push(Prisma.sql`manufacturer_slug = ${query.manufacturer}::citext`);
  if (query.inStock !== undefined) clauses.push(Prisma.sql`in_stock = ${query.inStock}`);
  if (query.q) {
    clauses.push(Prisma.sql`(
      name ILIKE ${`%${query.q}%`}
      OR short_description ILIKE ${`%${query.q}%`}
      OR manufacturer_name ILIKE ${`%${query.q}%`}
    )`);
  }

  if (clauses.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
}

function searchFilter(query: z.infer<typeof listQuerySchema>): string | undefined {
  const clauses: string[] = [];
  if (query.category) clauses.push(`category_slug:=${query.category}`);
  if (query.manufacturer) clauses.push(`manufacturer_slug:=${query.manufacturer}`);
  if (query.inStock !== undefined) clauses.push(`in_stock:=${query.inStock}`);
  return clauses.length > 0 ? clauses.join(' && ') : undefined;
}

async function countPublicProducts(where: Prisma.Sql): Promise<number> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM public_products
    ${where}
  `;
  return Number(rows[0]?.count ?? 0n);
}

catalogProjectionRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const prisma = getPrismaClient();
    const where = buildWhere(query);
    const offset = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      countPublicProducts(where),
      prisma.$queryRaw<PublicProjectionRow[]>`
        SELECT
          public_id::text,
          slug::text,
          name,
          short_description,
          long_description_md,
          manufacturer_slug::text,
          manufacturer_name,
          category_slug::text,
          category_name,
          primary_image,
          gallery_images,
          best_price_cents,
          curated_price,
          in_stock,
          offer_count,
          vendor_offers,
          specs,
          compatibility,
          featured,
          published_at
        FROM public_products
        ${where}
        ORDER BY ${orderBySql(query.sort)}
        LIMIT ${query.limit}
        OFFSET ${offset}
      `,
    ]);
    const totalPages = Math.max(Math.ceil(total / query.limit), 1);

    sendSuccess(res, rows.map(serializeProjection), 200, {
      pagination: {
        limit: query.limit,
        page: query.page,
        pageSize: rows.length,
        total,
        totalPages,
        hasMore: query.page < totalPages,
        nextCursor: null,
      },
    });
  })
);

catalogProjectionRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema
      .extend({ q: z.string().trim().max(200).default('*') })
      .parse(req.query);
    const result = await searchTypesenseProducts({
      q: query.q,
      page: query.page,
      perPage: query.limit,
      filterBy: searchFilter(query),
      sortBy: typeSenseSort(query.sort),
    });
    const totalPages = Math.max(Math.ceil(result.found / query.limit), 1);

    sendSuccess(
      res,
      result.hits.map((document) => ({
        publicId: document.public_id,
        slug: document.slug,
        name: document.name,
        shortDescription: document.short_description,
        manufacturer: {
          slug: document.manufacturer_slug,
          name: document.manufacturer_name,
        },
        category: {
          slug: document.category_slug,
          name: document.category_slug,
        },
        primaryImage: normalizeImage({ storage_key: document.primary_image_key }),
        bestPrice: {
          priceCents: document.best_price_cents,
          currency: 'USD',
          formatted: formatPrice(document.best_price_cents, 'USD'),
        },
        inStock: document.in_stock,
        offerCount: document.offer_count,
        featured: document.featured,
        publishedAt: document.published_at,
      })),
      200,
      {
        pagination: {
          limit: query.limit,
          page: query.page,
          pageSize: result.hits.length,
          total: result.found,
          totalPages,
          hasMore: query.page < totalPages,
          nextCursor: null,
        },
        facets: result.facetCounts,
      }
    );
  })
);

catalogProjectionRouter.get(
  '/products/:slug',
  asyncHandler(async (req, res) => {
    const parsedSlug = slug.parse(req.params.slug);
    const prisma = getPrismaClient();
    const rows = await prisma.$queryRaw<PublicProjectionRow[]>`
      SELECT
        public_id::text,
        slug::text,
        name,
        short_description,
        long_description_md,
        manufacturer_slug::text,
        manufacturer_name,
        category_slug::text,
        category_name,
        primary_image,
        gallery_images,
        best_price_cents,
        curated_price,
        in_stock,
        offer_count,
        vendor_offers,
        specs,
        compatibility,
        featured,
        published_at
      FROM public_products
      WHERE slug = ${parsedSlug}::citext
      LIMIT 1
    `;

    if (!rows[0]) throw notFound('Catalog product not found.', { slug: parsedSlug });
    sendSuccess(res, serializeProjection(rows[0]));
  })
);

catalogProjectionRouter.get(
  '/categories/:slug',
  asyncHandler(async (req, res) => {
    const parsedSlug = slug.parse(req.params.slug);
    const prisma = getPrismaClient();
    const rows = await prisma.$queryRaw`
      SELECT
        category_slug::text AS slug,
        category_name AS name,
        COUNT(*)::int AS product_count,
        MIN(best_price_cents) AS min_price_cents
      FROM public_products
      WHERE category_slug = ${parsedSlug}::citext
      GROUP BY category_slug, category_name
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;

    if (!row) throw notFound('Catalog category not found.', { slug: parsedSlug });
    sendSuccess(res, row);
  })
);

catalogProjectionRouter.get(
  '/manufacturers/:slug',
  asyncHandler(async (req, res) => {
    const parsedSlug = slug.parse(req.params.slug);
    const prisma = getPrismaClient();
    const rows = await prisma.$queryRaw`
      SELECT
        manufacturer_slug::text AS slug,
        manufacturer_name AS name,
        COUNT(*)::int AS product_count,
        MIN(best_price_cents) AS min_price_cents
      FROM public_products
      WHERE manufacturer_slug = ${parsedSlug}::citext
      GROUP BY manufacturer_slug, manufacturer_name
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;

    if (!row) throw notFound('Catalog manufacturer not found.', { slug: parsedSlug });
    sendSuccess(res, row);
  })
);

catalogProjectionRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const prisma = getPrismaClient();
    const config = getTypesenseConfig();
    const checks: Array<{ name: string; ok: boolean; details?: unknown }> = [];

    const projectionRows = await prisma.$queryRaw<
      Array<{ count: bigint; sample_slug: string | null }>
    >`
      SELECT COUNT(*)::bigint AS count, MIN(slug::text) AS sample_slug
      FROM public_products
    `;
    const projectionCount = Number(projectionRows[0]?.count ?? 0n);
    const sampleSlug = projectionRows[0]?.sample_slug ?? null;
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
      .map((row) => normalizeImage(row.primary_image))
      .filter((image) => image?.storageKey && image.url === null);
    checks.push({
      name: 'image URLs valid',
      ok: invalidImages.length === 0,
      details: { checked: imageRows.length, invalid: invalidImages.length },
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

    sendSuccess(res, {
      ok: checks.every((check) => check.ok),
      checks,
    });
  })
);
