import { createHash } from 'node:crypto';

import { getPrismaClient } from '@caracal/db';
import { Prisma, type StagingProductStatus } from '@prisma/client';
import { Router, type Request, type Router as ExpressRouter } from 'express';
import { z } from 'zod';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { badRequest, notFound } from '../lib/errors.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { catalogSyncLimiter } from '../middleware/rate-limit.js';

export const adminCatalogSyncRouter: ExpressRouter = Router();

const STAGING_STATUSES = [
  'PENDING',
  'READY',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
] as const satisfies readonly StagingProductStatus[];

const SOURCE_BRAND_TOKENS = [
  'automaxtools',
  'automax tools',
  'automax',
  'mk3',
  'obdii365',
  'uobdii',
];
const MIN_APPROVAL_PRICE_CENTS = readPositiveIntegerEnv(
  'SUPPLIER_SYNC_MIN_SALE_PRICE_CENTS',
  10000
);
const MAX_APPROVAL_PRICE_CENTS = readPositiveIntegerEnv(
  'SUPPLIER_SYNC_MAX_SALE_PRICE_CENTS',
  20000000
);

const listQuerySchema = z.object({
  status: z.enum(STAGING_STATUSES).default('PENDING'),
  limit: z.coerce.number().int().min(1).max(250).default(100),
});

const bulkActionSchema = z.object({
  ids: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(100)
    .transform((ids) => Array.from(new Set(ids))),
});

const idParamSchema = z.object({
  id: z.string().trim().min(1),
});

adminCatalogSyncRouter.use(catalogSyncLimiter);

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const productMatchSelect = {
  id: true,
  sku: true,
  name: true,
  priceCents: true,
  currency: true,
} satisfies Prisma.ProductSelect;

const stagingListInclude = {
  source: {
    select: {
      id: true,
      name: true,
      slug: true,
      baseUrl: true,
    },
  },
  matchedProduct: {
    select: productMatchSelect,
  },
} satisfies Prisma.StagingProductInclude;

const stagingForPublishInclude = {
  source: {
    select: {
      id: true,
      name: true,
      slug: true,
      baseUrl: true,
    },
  },
} satisfies Prisma.StagingProductInclude;

const productForPublishSelect = {
  id: true,
  sku: true,
  slug: true,
  name: true,
  priceCents: true,
  shortDescription: true,
  description: true,
  attributes: true,
  metadata: true,
} satisfies Prisma.ProductSelect;

const duplicateProductSelect = {
  id: true,
  sku: true,
  name: true,
  attributes: true,
  metadata: true,
} satisfies Prisma.ProductSelect;

type ProductMatch = Prisma.ProductGetPayload<{ select: typeof productMatchSelect }>;
type StagingListRow = Prisma.StagingProductGetPayload<{ include: typeof stagingListInclude }>;
type StagingForPublish = Prisma.StagingProductGetPayload<{
  include: typeof stagingForPublishInclude;
}>;
type ProductForPublish = Prisma.ProductGetPayload<{ select: typeof productForPublishSelect }>;

interface CatalogSyncActionResult {
  id: string;
  status: StagingProductStatus;
  productId: string | null;
  error?: string;
}

function parseCatalogSyncInput<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw badRequest('Invalid catalog sync request.', parsed.error.flatten());
  }

  return parsed.data;
}

function normalizeSku(value: string | null | undefined): string | null {
  const sku = value?.trim().toUpperCase().replace(/\s+/g, '-');
  return sku ? sku : null;
}

function shortHash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 10).toUpperCase();
}

function fallbackSku(staging: StagingForPublish): string {
  return `CTM-${shortHash(`${staging.sourceId}:${staging.sourceProductKey}`)}`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'catalog-product';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hostnameFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

function scrubSupplierBrand(value: string, staging: StagingForPublish): string {
  const hostname = hostnameFromUrl(staging.source.baseUrl);
  const tokens = [
    ...SOURCE_BRAND_TOKENS,
    staging.source.name,
    staging.source.slug,
    hostname,
    hostname?.split('.')[0],
  ]
    .filter((token): token is string => Boolean(token && token.trim().length > 2))
    .map((token) => token.trim());

  let scrubbed = value;
  for (const token of tokens) {
    scrubbed = scrubbed.replace(new RegExp(escapeRegExp(token), 'gi'), 'Caracal Tech Motors');
  }

  return scrubbed.replace(/\s+/g, ' ').trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function findNestedValue(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNestedValue(item, keys);
      if (found) return found;
    }

    return null;
  }

  const record = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(record)) {
    if (keys.includes(key.toLowerCase()) && typeof item === 'string' && item.trim()) {
      return item.trim().toUpperCase();
    }

    const found = findNestedValue(item, keys);
    if (found) return found;
  }

  return null;
}

function extractOemNumber(...values: unknown[]): string | null {
  const keys = ['oem', 'oemnumber', 'oem_number', 'manufacturerpartnumber', 'mpn'];

  for (const value of values) {
    const found = findNestedValue(value, keys);
    if (found) return found.replace(/\s+/g, '');
  }

  return null;
}

function stagedPriceCents(staging: {
  salePriceCents: number | null;
  convertedPriceCents: number | null;
  rawPriceCents: number | null;
}): number | null {
  return staging.salePriceCents ?? staging.convertedPriceCents ?? staging.rawPriceCents;
}

function priceChangePercent(stagedPrice: number | null, productionPrice: number | null) {
  if (stagedPrice === null || productionPrice === null || productionPrice <= 0) {
    return null;
  }

  return ((stagedPrice - productionPrice) / productionPrice) * 100;
}

function serializeStagingRow(row: StagingListRow, productionMatch: ProductMatch | null) {
  const stagedPrice = stagedPriceCents(row);
  const changePercent = priceChangePercent(stagedPrice, productionMatch?.priceCents ?? null);

  return {
    id: row.id,
    name: row.normalizedName,
    sku: normalizeSku(row.normalizedSku ?? row.externalSku),
    externalSku: row.externalSku,
    source: row.source,
    normalizedPriceCents: stagedPrice,
    oldPriceCents: row.oldPriceCents,
    rawPriceCents: row.rawPriceCents,
    rawCurrency: row.rawCurrency,
    stockStatus: row.stockStatus,
    status: row.status,
    lastScrapedAt: row.lastSeenAt,
    externalUrl: row.externalUrl,
    warnings: row.warnings,
    rejectReasons: row.rejectReasons,
    diff: {
      productionProductId: productionMatch?.id ?? null,
      productionSku: productionMatch?.sku ?? null,
      productionName: productionMatch?.name ?? null,
      productionPriceCents: productionMatch?.priceCents ?? null,
      productionCurrency: productionMatch?.currency ?? 'AED',
      stagedPriceCents: stagedPrice,
      changePercent,
      overThreshold: changePercent === null ? false : Math.abs(changePercent) > 20,
    },
  };
}

function deriveCategory(input: string | null | undefined, name: string) {
  const text = `${input ?? ''} ${name}`.toLowerCase();

  if (/(cable|adapter|connector|obd cable)/.test(text)) {
    return { name: 'Cables & Adapters', slug: 'cables-adapters' };
  }

  if (/(key|immo|xhorse|vvdi|programmer)/.test(text)) {
    return { name: 'Key Programming', slug: 'key-programming' };
  }

  if (/(diagnostic|scanner|launch|autel|obd|tester)/.test(text)) {
    return { name: 'Diagnostic Tools', slug: 'diagnostic-tools' };
  }

  if (/(subscription|token|license|software|online)/.test(text)) {
    return { name: 'Digital Services', slug: 'digital-services' };
  }

  return { name: 'Tuning Tools', slug: 'tuning-tools' };
}

async function ensureUniqueProductSlug(
  tx: Prisma.TransactionClient,
  baseSlug: string,
  currentProductId?: string
): Promise<string> {
  for (let suffix = 0; suffix <= 20; suffix += 1) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    const existing = await tx.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === currentProductId) {
      return candidate;
    }
  }

  return `${baseSlug}-${shortHash(`${baseSlug}:${Date.now()}`)}`;
}

async function ensureCaracalSupplier(tx: Prisma.TransactionClient) {
  return tx.supplier.upsert({
    where: { slug: 'caracal-tech-motors' },
    update: {
      name: 'Caracal Tech Motors',
      websiteUrl: 'https://caracaltechmotors.com',
    },
    create: {
      name: 'Caracal Tech Motors',
      slug: 'caracal-tech-motors',
      websiteUrl: 'https://caracaltechmotors.com',
      notes: 'Internal supplier record for approved catalog sync products.',
    },
  });
}

async function ensureCategory(
  tx: Prisma.TransactionClient,
  staging: StagingForPublish,
  name: string
) {
  const category = deriveCategory(staging.categoryName, name);

  return tx.category.upsert({
    where: { slug: category.slug },
    update: {
      name: category.name,
      isActive: true,
    },
    create: {
      name: category.name,
      slug: category.slug,
      isActive: true,
      description: `Caracal Tech Motors ${category.name.toLowerCase()} catalog items.`,
    },
  });
}

async function findProductionProduct(
  tx: Prisma.TransactionClient,
  staging: StagingForPublish,
  sku: string,
  cleanName: string
): Promise<ProductForPublish | null> {
  if (staging.matchedProductId) {
    const byId = await tx.product.findUnique({
      where: { id: staging.matchedProductId },
      select: productForPublishSelect,
    });

    if (byId) return byId;
  }

  const bySku = await tx.product.findUnique({
    where: { sku },
    select: productForPublishSelect,
  });

  if (bySku) return bySku;

  const normalizedTitle = normalizeTitle(cleanName);
  const oemNumber = extractOemNumber(staging.rawData, staging.normalizedData);
  const candidates = oemNumber
    ? await tx.product.findMany({ select: duplicateProductSelect })
    : await tx.product.findMany({
        where: {
          OR: [
            { name: { equals: cleanName, mode: 'insensitive' } },
            { name: { contains: cleanName.slice(0, 40), mode: 'insensitive' } },
          ],
        },
        select: duplicateProductSelect,
        take: 50,
      });
  const duplicateMatches = candidates.filter((product) => {
    if (normalizeTitle(product.name) === normalizedTitle) {
      return true;
    }

    if (!oemNumber) {
      return false;
    }

    const productOem = extractOemNumber(product.attributes, product.metadata);
    return productOem === oemNumber;
  });

  if (duplicateMatches.length > 1) {
    throw badRequest('Multiple possible duplicate products were found before publish.', {
      sku,
      oemNumber,
      normalizedTitle,
      productIds: duplicateMatches.map((product) => product.id),
    });
  }

  if (duplicateMatches[0]) {
    return tx.product.findUnique({
      where: { id: duplicateMatches[0].id },
      select: productForPublishSelect,
    });
  }

  return null;
}

async function publishStagingProduct(
  tx: Prisma.TransactionClient,
  id: string,
  adminUserId: string | undefined
): Promise<CatalogSyncActionResult> {
  const staging = await tx.stagingProduct.findUnique({
    where: { id },
    include: stagingForPublishInclude,
  });

  if (!staging) {
    throw notFound('Staging product not found.', { id });
  }

  if (staging.status === 'REJECTED') {
    throw badRequest('Rejected staging products cannot be approved.', { id });
  }

  const priceCents = stagedPriceCents(staging);
  if (priceCents === null) {
    throw badRequest('Staging product is missing a normalized price.', { id });
  }

  const rejectReasons = readStringArray(staging.rejectReasons);
  if (rejectReasons.length > 0) {
    throw badRequest('Staging product has blocking validation issues.', {
      id,
      rejectReasons,
    });
  }

  if (priceCents < MIN_APPROVAL_PRICE_CENTS) {
    throw badRequest('Staging product price is below the approval threshold.', {
      id,
      priceCents,
      minimumPriceCents: MIN_APPROVAL_PRICE_CENTS,
    });
  }

  if (priceCents > MAX_APPROVAL_PRICE_CENTS) {
    throw badRequest('Staging product price is above the approval threshold.', {
      id,
      priceCents,
      maximumPriceCents: MAX_APPROVAL_PRICE_CENTS,
    });
  }

  const sku = normalizeSku(staging.normalizedSku ?? staging.externalSku) ?? fallbackSku(staging);
  const cleanName = scrubSupplierBrand(staging.normalizedName || staging.externalName, staging);
  const supplier = await ensureCaracalSupplier(tx);
  const category = await ensureCategory(tx, staging, cleanName);
  const existing = await findProductionProduct(tx, staging, sku, cleanName);
  const normalizedData = asRecord(staging.normalizedData);
  const stagedDescription =
    readString(normalizedData.description) ?? readString(normalizedData.shortDescription);
  const fallbackDescription = 'Catalog item available through Caracal Tech Motors.';
  const shortDescription = scrubSupplierBrand(
    existing?.shortDescription ?? stagedDescription ?? fallbackDescription,
    staging
  );
  const description = scrubSupplierBrand(
    existing?.description ?? stagedDescription ?? fallbackDescription,
    staging
  );
  const attributes = {
    ...asRecord(existing?.attributes),
    inquiryReady: true,
    oldPriceCents: staging.oldPriceCents,
    salePriceCents: priceCents,
    saleDiscountPercent: staging.discountPercent,
    pricing: {
      oldPriceCents: staging.oldPriceCents,
      salePriceCents: priceCents,
      discountPercent: staging.discountPercent,
      marginPercent: staging.marginPercent,
    },
  };
  const metadata = {
    ...asRecord(existing?.metadata),
    catalogSync: {
      stagingProductId: staging.id,
      sourceId: staging.sourceId,
      sourceProductKey: staging.sourceProductKey,
      externalUrl: staging.externalUrl,
      lastScrapedAt: staging.lastSeenAt.toISOString(),
      approvedAt: new Date().toISOString(),
    },
  };
  const productSlug =
    existing?.slug ??
    (await ensureUniqueProductSlug(tx, `${slugify(cleanName)}-${shortHash(sku).toLowerCase()}`));
  const now = new Date();
  const productData = {
    name: cleanName,
    shortDescription,
    description,
    status: 'ACTIVE' as const,
    priceCents,
    currency: 'AED',
    category: { connect: { id: category.id } },
    supplier: { connect: { id: supplier.id } },
    isTradeOnly: false,
    attributes: toPrismaJson(attributes),
    metadata: toPrismaJson(metadata),
    publishedAt: now,
  };
  const product = existing
    ? await tx.product.update({
        where: { id: existing.id },
        data: productData,
        select: { id: true },
      })
    : await tx.product.create({
        data: {
          ...productData,
          sku,
          slug: productSlug,
        },
        select: { id: true },
      });
  const quantityOnHand =
    staging.stockStatus === 'OUT_OF_STOCK' || staging.stockStatus === 'DISCONTINUED' ? 0 : 1;

  await tx.inventoryItem.upsert({
    where: {
      productId_locationKey: {
        productId: product.id,
        locationKey: 'supplier-sync',
      },
    },
    update: {
      quantityOnHand,
      status: staging.stockStatus,
      locationLabel: 'Supplier catalog',
    },
    create: {
      productId: product.id,
      locationKey: 'supplier-sync',
      locationLabel: 'Supplier catalog',
      quantityOnHand,
      status: staging.stockStatus,
      metadata: toPrismaJson({ source: 'catalog-sync' }),
    },
  });

  if (staging.imageApproved && staging.imageUrl) {
    await tx.productImage.upsert({
      where: {
        productId_url: {
          productId: product.id,
          url: staging.imageUrl,
        },
      },
      update: {
        altText: cleanName,
        isPrimary: true,
      },
      create: {
        productId: product.id,
        url: staging.imageUrl,
        altText: cleanName,
        isPrimary: true,
        sortOrder: 0,
        metadata: toPrismaJson({ source: 'approved-catalog-sync' }),
      },
    });
  }

  const updated = await tx.stagingProduct.update({
    where: { id: staging.id },
    data: {
      status: 'APPROVED',
      matchedProductId: product.id,
      approvedAt: now,
      publishedAt: now,
    },
    select: {
      id: true,
      status: true,
    },
  });

  await tx.catalogApprovalLog.create({
    data: {
      adminUserId,
      stagingProductId: staging.id,
      stagingRowId: staging.id,
      action: 'APPROVE',
      oldValue: toPrismaJson({
        stagingStatus: staging.status,
        matchedProductId: staging.matchedProductId,
        product: existing
          ? {
              id: existing.id,
              sku: existing.sku,
              name: existing.name,
              priceCents: existing.priceCents,
            }
          : null,
      }),
      newValue: toPrismaJson({
        stagingStatus: updated.status,
        productId: product.id,
        sku,
        name: cleanName,
        priceCents,
        duplicateMatchedBy: existing ? 'sku_oem_or_title' : null,
      }),
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    productId: product.id,
  };
}

async function approveOne(req: Request, id: string): Promise<CatalogSyncActionResult> {
  const prisma = getPrismaClient();
  const result = await prisma.$transaction((tx) => publishStagingProduct(tx, id, req.auth?.userId));

  await writeAuditLog(req, {
    action: 'admin.catalog_sync.approved',
    entityType: 'StagingProduct',
    entityId: id,
    metadata: {
      productId: result.productId,
      status: result.status,
    },
  });

  return result;
}

async function rejectOne(req: Request, id: string): Promise<CatalogSyncActionResult> {
  const prisma = getPrismaClient();
  const updated = await prisma
    .$transaction(async (tx) => {
      const existing = await tx.stagingProduct.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          matchedProductId: true,
          rejectReasons: true,
        },
      });

      if (!existing) {
        throw notFound('Staging product not found.', { id });
      }

      const row = await tx.stagingProduct.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectReasons: toPrismaJson(['Rejected from admin catalog sync dashboard.']),
        },
        select: {
          id: true,
          status: true,
          matchedProductId: true,
        },
      });

      await tx.catalogApprovalLog.create({
        data: {
          adminUserId: req.auth?.userId,
          stagingProductId: existing.id,
          stagingRowId: existing.id,
          action: 'REJECT',
          oldValue: toPrismaJson({
            stagingStatus: existing.status,
            matchedProductId: existing.matchedProductId,
            rejectReasons: existing.rejectReasons,
          }),
          newValue: toPrismaJson({
            stagingStatus: row.status,
            matchedProductId: row.matchedProductId,
            rejectReasons: ['Rejected from admin catalog sync dashboard.'],
          }),
        },
      });

      return row;
    })
    .catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw notFound('Staging product not found.', { id });
      }

      throw error;
    });

  await writeAuditLog(req, {
    action: 'admin.catalog_sync.rejected',
    entityType: 'StagingProduct',
    entityId: id,
    metadata: {
      productId: updated.matchedProductId,
      status: updated.status,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    productId: updated.matchedProductId,
  };
}

async function runBulk(
  req: Request,
  ids: string[],
  action: (req: Request, id: string) => Promise<CatalogSyncActionResult>
): Promise<CatalogSyncActionResult[]> {
  const results: CatalogSyncActionResult[] = [];

  for (const id of ids) {
    try {
      results.push(await action(req, id));
    } catch (error) {
      results.push({
        id,
        status: 'PENDING',
        productId: null,
        error: error instanceof Error ? error.message : 'Bulk action failed.',
      });
    }
  }

  return results;
}

adminCatalogSyncRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const { status, limit } = parseCatalogSyncInput(listQuerySchema, req.query);
    const rows = await prisma.stagingProduct.findMany({
      where: { status },
      include: stagingListInclude,
      orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    const skus = Array.from(
      new Set(
        rows
          .map((row) => normalizeSku(row.normalizedSku ?? row.externalSku))
          .filter((sku): sku is string => Boolean(sku))
      )
    );
    const products =
      skus.length > 0
        ? await prisma.product.findMany({
            where: { sku: { in: skus } },
            select: productMatchSelect,
          })
        : [];
    const productsBySku = new Map(products.map((product) => [product.sku.toUpperCase(), product]));
    const data = rows.map((row) => {
      const sku = normalizeSku(row.normalizedSku ?? row.externalSku);
      const productionMatch = row.matchedProduct ?? (sku ? (productsBySku.get(sku) ?? null) : null);

      return serializeStagingRow(row, productionMatch);
    });

    sendSuccess(res, data);
  })
);

adminCatalogSyncRouter.post(
  '/bulk/approve',
  asyncHandler(async (req, res) => {
    const { ids } = parseCatalogSyncInput(bulkActionSchema, req.body);
    const results = await runBulk(req, ids, approveOne);

    sendSuccess(res, results);
  })
);

adminCatalogSyncRouter.post(
  '/bulk/reject',
  asyncHandler(async (req, res) => {
    const { ids } = parseCatalogSyncInput(bulkActionSchema, req.body);
    const results = await runBulk(req, ids, rejectOne);

    sendSuccess(res, results);
  })
);

adminCatalogSyncRouter.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const { id } = parseCatalogSyncInput(idParamSchema, req.params);
    const result = await approveOne(req, id);

    sendSuccess(res, result);
  })
);

adminCatalogSyncRouter.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const { id } = parseCatalogSyncInput(idParamSchema, req.params);
    const result = await rejectOne(req, id);

    sendSuccess(res, result);
  })
);
