import { getPrismaClient } from '@caracal/db';
import { Prisma } from '@prisma/client';
import { Router, type Response, type Router as ExpressRouter } from 'express';
import { z } from 'zod';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { badRequest, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { AED_CURRENCY } from '../lib/catalog/pricing.js';
import { searchTypesenseProducts } from '../lib/catalog/typesense.js';

export const catalogProjectionRouter: ExpressRouter = Router();

const slug = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sort = z.enum(['featured', 'newest', 'name', 'price_asc', 'price_desc']).default('featured');
const queryBoolean = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === true || value === 'true' || value === '1' || value === 'in') return true;
  if (value === false || value === 'false' || value === '0' || value === 'out') return false;
  return value;
}, z.boolean().optional());
const listQuerySchema = z.object({
  category: slug.optional(),
  manufacturer: slug.optional(),
  inStock: queryBoolean,
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  sort,
});
const searchQuerySchema = listQuerySchema.extend({
  q: z.string().trim().max(200).default('*'),
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
  price_currency: string;
  sell_price_cents: bigint | number | null;
  compare_at_cents: bigint | number | null;
  discount_pct: number | null;
  curated_price: unknown;
  in_stock: boolean;
  offer_count: number;
  vendor_offers: unknown;
  sourcing_vendor_name: string | null;
  specs: unknown;
  compatibility: unknown;
  featured: boolean;
  published_at: Date | string | null;
}

const countCache = new Map<string, { expiresAt: number; total: number }>();

function toNumber(value: bigint | number | null): number | null {
  if (value === null) return null;
  return typeof value === 'bigint' ? Number(value) : value;
}

function imageUrlFromProjectionKey(assetKey: unknown): string | null {
  if (typeof assetKey !== 'string' || !assetKey.trim()) return null;
  if (assetKey.startsWith('http://') || assetKey.startsWith('https://')) return assetKey;
  const publicBase = process.env.CATALOG_IMAGE_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (publicBase && !assetKey.startsWith('local://')) {
    return `${publicBase}/${assetKey.replace(/^\/+/, '')}`;
  }
  return null;
}

function normalizeImage(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const assetKey = typeof item.storage_key === 'string' ? item.storage_key : null;

  return {
    url: imageUrlFromProjectionKey(assetKey),
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
  };
}

function normalizePrice(cents: number | null, currency: string) {
  if (cents === null) return null;

  return {
    priceCents: cents,
    currency,
    formatted: formatPrice(cents, currency),
  };
}

function serializeProjection(row: PublicProjectionRow) {
  const bestPriceCents = toNumber(row.best_price_cents);
  const sellPriceCents = toNumber(row.sell_price_cents);
  const compareAtCents = toNumber(row.compare_at_cents);
  const curatedPrice = normalizeCuratedPrice(row.curated_price);
  const currency = curatedPrice?.currency ?? row.price_currency;

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
      currency,
      formatted: formatPrice(bestPriceCents, currency),
    },
    sellPrice: normalizePrice(sellPriceCents, AED_CURRENCY),
    compareAt: normalizePrice(compareAtCents, AED_CURRENCY),
    discountPct: row.discount_pct,
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
      };
    }),
    sourcingVendorName: row.sourcing_vendor_name,
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
  if (clauses.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
}

function searchFilter(query: z.infer<typeof searchQuerySchema>): string | undefined {
  const clauses: string[] = [];
  if (query.category) clauses.push(`category_slug:=${query.category}`);
  if (query.manufacturer) clauses.push(`manufacturer_slug:=${query.manufacturer}`);
  if (query.inStock !== undefined) clauses.push(`in_stock:=${query.inStock}`);
  return clauses.length > 0 ? clauses.join(' && ') : undefined;
}

function countCacheTtlMs(): number {
  return Number.parseInt(process.env.CATALOG_PUBLIC_COUNT_CACHE_MS ?? '30000', 10);
}

function countCacheKey(query: z.infer<typeof listQuerySchema>): string {
  return JSON.stringify({
    category: query.category ?? null,
    manufacturer: query.manufacturer ?? null,
    inStock: query.inStock ?? null,
  });
}

async function countPublicProducts(where: Prisma.Sql, cacheKey: string): Promise<number> {
  const cached = countCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.total;
  }

  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM public_products
    ${where}
  `;
  const total = Number(rows[0]?.count ?? 0n);
  countCache.set(cacheKey, { total, expiresAt: Date.now() + countCacheTtlMs() });
  return total;
}

function setCatalogCacheHeaders(res: Response): void {
  const maxAge = Number.parseInt(process.env.CATALOG_PUBLIC_CACHE_MAX_AGE_SECONDS ?? '30', 10);
  const staleWhileRevalidate = Number.parseInt(
    process.env.CATALOG_PUBLIC_CACHE_STALE_SECONDS ?? '120',
    10
  );
  res.set(
    'Cache-Control',
    `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  );
}

function logProjectionRead(input: {
  route: string;
  startedAt: number;
  total?: number;
  returned?: number;
  filters?: unknown;
}): void {
  logger.info(
    {
      route: input.route,
      durationMs: Date.now() - input.startedAt,
      total: input.total,
      returned: input.returned,
      filters: input.filters,
    },
    'catalog projection read'
  );
}

catalogProjectionRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    if (req.query.q !== undefined) {
      throw badRequest('Use /api/catalog/search for q searches.', { rejectedParam: 'q' });
    }

    const startedAt = Date.now();
    const query = listQuerySchema.parse(req.query);
    const prisma = getPrismaClient();
    const where = buildWhere(query);
    const offset = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      countPublicProducts(where, countCacheKey(query)),
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
          price_currency,
          sell_price_cents,
          compare_at_cents,
          discount_pct,
          curated_price,
          in_stock,
          offer_count,
          vendor_offers,
          sourcing_vendor_name,
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

    setCatalogCacheHeaders(res);
    logProjectionRead({
      route: '/api/catalog/products',
      startedAt,
      total,
      returned: rows.length,
      filters: {
        category: query.category,
        manufacturer: query.manufacturer,
        inStock: query.inStock,
        page: query.page,
      },
    });
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
    const startedAt = Date.now();
    const query = searchQuerySchema.parse(req.query);
    const result = await searchTypesenseProducts({
      q: query.q,
      page: query.page,
      perPage: query.limit,
      filterBy: searchFilter(query),
      sortBy: typeSenseSort(query.sort),
    });
    const totalPages = Math.max(Math.ceil(result.found / query.limit), 1);

    setCatalogCacheHeaders(res);
    logProjectionRead({
      route: '/api/catalog/search',
      startedAt,
      total: result.found,
      returned: result.hits.length,
      filters: {
        q: query.q ? 'present' : 'empty',
        category: query.category,
        manufacturer: query.manufacturer,
        inStock: query.inStock,
        page: query.page,
      },
    });
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
          name: document.category_name,
        },
        primaryImage: normalizeImage({ storage_key: document.primary_image_key }),
        bestPrice: {
          priceCents: document.best_price_cents,
          currency: document.currency,
          formatted: formatPrice(document.best_price_cents, document.currency),
        },
        sellPrice: normalizePrice(document.sell_price_cents ?? null, AED_CURRENCY),
        compareAt: normalizePrice(document.compare_at_cents ?? null, AED_CURRENCY),
        discountPct: document.discount_pct ?? null,
        sourcingVendorName: document.sourcing_vendor_name ?? null,
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
    const startedAt = Date.now();
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
        price_currency,
        sell_price_cents,
        compare_at_cents,
        discount_pct,
        curated_price,
        in_stock,
        offer_count,
        vendor_offers,
        sourcing_vendor_name,
        specs,
        compatibility,
        featured,
        published_at
      FROM public_products
      WHERE slug = ${parsedSlug}::citext
      LIMIT 1
    `;

    if (!rows[0]) throw notFound('Catalog product not found.', { slug: parsedSlug });
    setCatalogCacheHeaders(res);
    logProjectionRead({
      route: '/api/catalog/products/:slug',
      startedAt,
      returned: 1,
      filters: { slug: parsedSlug },
    });
    sendSuccess(res, serializeProjection(rows[0]));
  })
);

catalogProjectionRouter.get(
  '/categories/:slug',
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();
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
    setCatalogCacheHeaders(res);
    logProjectionRead({
      route: '/api/catalog/categories/:slug',
      startedAt,
      returned: 1,
      filters: { slug: parsedSlug },
    });
    sendSuccess(res, row);
  })
);

catalogProjectionRouter.get(
  '/manufacturers/:slug',
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();
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
    setCatalogCacheHeaders(res);
    logProjectionRead({
      route: '/api/catalog/manufacturers/:slug',
      startedAt,
      returned: 1,
      filters: { slug: parsedSlug },
    });
    sendSuccess(res, row);
  })
);
