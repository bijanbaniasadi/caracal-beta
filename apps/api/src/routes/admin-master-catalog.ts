import { getPrismaClient } from '@caracal/db';
import type { Prisma } from '@prisma/client';
import { Router, type Request, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { enqueueCatalogProjectionJob } from '../lib/catalog/queues.js';
import {
  buildMasterPricingSnapshotUpdate,
  repriceMasterInTransaction,
} from '../lib/catalog/pricing-snapshot.js';
import { badRequest, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { validateBody } from '../middleware/validate.js';
import {
  catalogProductImageCreateSchema,
  catalogProductImageUpdateSchema,
  masterProductArchiveSchema,
  masterProductCreateSchema,
  masterProductListQuerySchema,
  masterProductPublishSchema,
  masterProductRepriceSchema,
  masterProductUpdateSchema,
  vendorOfferCreateSchema,
  vendorOfferUpdateSchema,
  type CatalogProductImageCreateInput,
  type CatalogProductImageUpdateInput,
  type MasterProductArchiveInput,
  type MasterProductCreateInput,
  type MasterProductListQuery,
  type MasterProductPublishInput,
  type MasterProductRepriceInput,
  type MasterProductUpdateInput,
  type VendorOfferCreateInput,
  type VendorOfferUpdateInput,
} from '../schemas/master-catalog.js';

export const adminMasterCatalogRouter: ExpressRouter = Router();

const masterProductDetailInclude = {
  category: true,
  manufacturer: true,
  offers: {
    include: {
      vendor: true,
      priceHistory: {
        orderBy: { observedAt: 'desc' },
        take: 5,
      },
    },
    orderBy: { updatedAt: 'desc' },
  },
  images: {
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
  },
  specs: {
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
  },
  tags: {
    include: { tag: true },
  },
  compatibility: true,
} satisfies Prisma.MasterProductInclude;

type MasterProductDetail = Prisma.MasterProductGetPayload<{
  include: typeof masterProductDetailInclude;
}>;

function parseBigIntId(value: string, label = 'id'): bigint {
  try {
    return BigInt(value);
  } catch {
    throw badRequest(`Invalid ${label}.`, { [label]: value });
  }
}

function optionalBigIntId(value: string | null | undefined, label: string): bigint | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return parseBigIntId(value, label);
}

function requestId(req: Request): string | undefined {
  const header = req.get('x-request-id');
  return header && header.trim().length > 0 ? header : undefined;
}

function actorId(req: Request): string {
  if (!req.auth?.userId) {
    throw badRequest('Admin user id is required.');
  }

  return req.auth.userId;
}

function serializeOffer(offer: {
  id: bigint;
  productId: bigint;
  vendorId: bigint;
  vendorSku: string | null;
  vendorUrl: string;
  priceCents: bigint | null;
  currency: string;
  inStock: boolean | null;
  lastSeenAt: Date;
  status: string;
  confidence: Prisma.Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: offer.id.toString(),
    productId: offer.productId.toString(),
    vendorId: offer.vendorId.toString(),
    vendorSku: offer.vendorSku,
    vendorUrl: offer.vendorUrl,
    priceCents: offer.priceCents?.toString() ?? null,
    currency: offer.currency,
    inStock: offer.inStock,
    lastSeenAt: offer.lastSeenAt,
    status: offer.status,
    confidence: offer.confidence.toNumber(),
    notes: offer.notes,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  };
}

function serializeImage(image: {
  id: bigint;
  productId: bigint;
  storageKey: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
  sourceVendorId: bigint | null;
  createdAt: Date;
}) {
  return {
    id: image.id.toString(),
    productId: image.productId.toString(),
    storageKey: image.storageKey,
    width: image.width,
    height: image.height,
    mimeType: image.mimeType,
    altText: image.altText,
    isPrimary: image.isPrimary,
    sortOrder: image.sortOrder,
    sourceVendorId: image.sourceVendorId?.toString() ?? null,
    createdAt: image.createdAt,
  };
}

function serializeMasterProduct(product: MasterProductDetail) {
  return {
    id: product.id.toString(),
    publicId: product.publicId,
    slug: product.slug,
    sku: product.sku,
    mpn: product.mpn,
    name: product.name,
    shortDescription: product.shortDescription,
    longDescriptionMd: product.longDescriptionMd,
    manufacturerId: product.manufacturerId?.toString() ?? null,
    manufacturerSlug: product.manufacturer?.slug ?? product.manufacturerSlug,
    manufacturerName: product.manufacturer?.name ?? product.manufacturerName,
    categoryId: product.categoryId.toString(),
    category: {
      id: product.category.id.toString(),
      slug: product.category.slug,
      name: product.category.name,
    },
    status: product.status,
    fingerprint: product.fingerprint,
    featured: product.featured,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    pricedSellCents: product.pricedSellCents?.toString() ?? null,
    pricedCurrency: product.pricedCurrency,
    pricedAt: product.pricedAt,
    pricedSourceCostCents: product.pricedSourceCostCents?.toString() ?? null,
    pricedSourceCurrency: product.pricedSourceCurrency,
    pricedFxRateToAed: product.pricedFxRateToAed?.toString() ?? null,
    pricedMarginBps: product.pricedMarginBps,
    publishedAt: product.publishedAt,
    archivedAt: product.archivedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    offers: product.offers.map((offer) => ({
      ...serializeOffer(offer),
      vendor: {
        id: offer.vendor.id.toString(),
        slug: offer.vendor.slug,
        name: offer.vendor.name,
      },
      priceHistory: offer.priceHistory.map((history) => ({
        id: history.id.toString(),
        offerId: history.offerId.toString(),
        priceCents: history.priceCents.toString(),
        currency: history.currency,
        inStock: history.inStock,
        observedAt: history.observedAt,
      })),
    })),
    images: product.images.map(serializeImage),
    specs: product.specs.map((spec) => ({
      id: spec.id.toString(),
      key: spec.key,
      value: spec.value,
      unit: spec.unit,
      sortOrder: spec.sortOrder,
    })),
    tags: product.tags.map((link) => ({
      id: link.tag.id.toString(),
      slug: link.tag.slug,
      name: link.tag.name,
    })),
    compatibility: product.compatibility.map((item) => ({
      id: item.id.toString(),
      make: item.make,
      model: item.model,
      yearFrom: item.yearFrom,
      yearTo: item.yearTo,
      ecu: item.ecu,
      notes: item.notes,
    })),
  };
}

function masterProductCreateData(
  input: MasterProductCreateInput,
  userId: string
): Prisma.MasterProductCreateInput {
  return {
    slug: input.slug,
    sku: input.sku,
    mpn: input.mpn,
    name: input.name,
    shortDescription: input.shortDescription,
    longDescriptionMd: input.longDescriptionMd,
    manufacturer: input.manufacturerId
      ? { connect: { id: parseBigIntId(input.manufacturerId, 'manufacturerId') } }
      : undefined,
    manufacturerSlug: input.manufacturerSlug,
    manufacturerName: input.manufacturerName,
    category: { connect: { id: parseBigIntId(input.categoryId, 'categoryId') } },
    status: input.status,
    fingerprint: input.fingerprint,
    featured: input.featured,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    createdBy: { connect: { id: userId } },
    updatedBy: { connect: { id: userId } },
  };
}

function masterProductUpdateData(
  input: MasterProductUpdateInput,
  userId: string
): Prisma.MasterProductUpdateInput {
  return {
    slug: input.slug,
    sku: input.sku,
    mpn: input.mpn,
    name: input.name,
    shortDescription: input.shortDescription,
    longDescriptionMd: input.longDescriptionMd,
    manufacturer:
      input.manufacturerId === null
        ? { disconnect: true }
        : input.manufacturerId
          ? { connect: { id: parseBigIntId(input.manufacturerId, 'manufacturerId') } }
          : undefined,
    manufacturerSlug: input.manufacturerSlug,
    manufacturerName: input.manufacturerName,
    category: input.categoryId
      ? { connect: { id: parseBigIntId(input.categoryId, 'categoryId') } }
      : undefined,
    status: input.status,
    fingerprint: input.fingerprint,
    featured: input.featured,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    updatedBy: { connect: { id: userId } },
  };
}

async function audit(
  tx: Prisma.TransactionClient,
  req: Request,
  input: {
    entityType: string;
    entityId: bigint;
    action: string;
    diff?: unknown;
  }
) {
  await tx.adminAuditLog.create({
    data: {
      userId: actorId(req),
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      diff: toPrismaJson(input.diff),
      requestId: requestId(req),
    },
  });
}

async function enqueueProjectionAfterMutation(input: {
  masterProductId: bigint;
  action: string;
}): Promise<void> {
  try {
    await enqueueCatalogProjectionJob({
      type: 'project-product',
      masterProductId: input.masterProductId.toString(),
      reason: `admin.${input.action}`,
    });
  } catch (error) {
    logger.error(
      { err: error, masterProductId: input.masterProductId.toString(), action: input.action },
      'catalog projection enqueue failed after admin mutation'
    );
  }
}

async function publishBlockers(
  tx: Prisma.TransactionClient,
  product: {
    id: bigint;
    slug: string;
    manufacturerId: bigint | null;
    manufacturerSlug: string;
    manufacturerName: string;
    categoryId: bigint;
    longDescriptionMd: string | null;
  }
): Promise<string[]> {
  const [primaryImages, activeOffers] = await Promise.all([
    tx.catalogProductImage.count({ where: { productId: product.id, isPrimary: true } }),
    tx.vendorOffer.count({ where: { productId: product.id, status: 'ACTIVE' } }),
  ]);
  const blockers: string[] = [];

  if (!product.slug.trim()) blockers.push('slug');
  if (!product.manufacturerId && !product.manufacturerSlug.trim()) blockers.push('manufacturer');
  if (!product.manufacturerName.trim()) blockers.push('manufacturer_name');
  if (!product.categoryId) blockers.push('category_id');
  if (!product.longDescriptionMd?.trim()) blockers.push('long_description_md');
  if (primaryImages < 1) blockers.push('primary_image');
  if (activeOffers < 1) blockers.push('active_offer');

  return blockers;
}

function parseListQuery(req: Request): MasterProductListQuery {
  return masterProductListQuerySchema.parse(req.query);
}

adminMasterCatalogRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req);
    const prisma = getPrismaClient();
    const where: Prisma.MasterProductWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q, mode: 'insensitive' } },
              { fingerprint: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await prisma.masterProduct.findMany({
      where,
      include: masterProductDetailInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: parseBigIntId(query.cursor) }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const pageItems = hasMore ? rows.slice(0, query.limit) : rows;

    sendSuccess(res, pageItems.map(serializeMasterProduct), 200, {
      pagination: {
        limit: query.limit,
        hasMore,
        nextCursor: hasMore ? pageItems[pageItems.length - 1]?.id.toString() : null,
      },
    });
  })
);

adminMasterCatalogRouter.post(
  '/',
  validateBody(masterProductCreateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as MasterProductCreateInput;
    if (input.status === 'PUBLISHED') {
      throw badRequest('Create cannot publish a master product; use the publish workflow.', {
        requestedStatus: input.status,
      });
    }

    const userId = actorId(req);
    const prisma = getPrismaClient();
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.masterProduct.create({
        data: masterProductCreateData(input, userId),
        include: masterProductDetailInclude,
      });

      await audit(tx, req, {
        entityType: 'master_product',
        entityId: created.id,
        action: 'create',
        diff: { after: input },
      });

      return created;
    });

    await enqueueProjectionAfterMutation({ masterProductId: product.id, action: 'create' });
    sendSuccess(res, serializeMasterProduct(product), 201);
  })
);

adminMasterCatalogRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const product = await prisma.masterProduct.findUnique({
      where: { id: parseBigIntId(req.params.id) },
      include: masterProductDetailInclude,
    });

    if (!product) {
      throw notFound('Master product not found.', { id: req.params.id });
    }

    sendSuccess(res, serializeMasterProduct(product));
  })
);

adminMasterCatalogRouter.patch(
  '/:id',
  validateBody(masterProductUpdateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as MasterProductUpdateInput;
    if (input.status === 'PUBLISHED') {
      throw badRequest('Update cannot publish a master product; use the publish workflow.', {
        requestedStatus: input.status,
      });
    }

    const id = parseBigIntId(req.params.id);
    const userId = actorId(req);
    const prisma = getPrismaClient();
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.masterProduct.findUnique({ where: { id } });

      if (!existing) {
        throw notFound('Master product not found.', { id: id.toString() });
      }

      const updated = await tx.masterProduct.update({
        where: { id },
        data: masterProductUpdateData(input, userId),
        include: masterProductDetailInclude,
      });

      await audit(tx, req, {
        entityType: 'master_product',
        entityId: id,
        action: 'update',
        diff: { before: existing, after: input },
      });

      return updated;
    });

    await enqueueProjectionAfterMutation({ masterProductId: id, action: 'update' });
    sendSuccess(res, serializeMasterProduct(product));
  })
);

adminMasterCatalogRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseBigIntId(req.params.id);
    const userId = actorId(req);
    const prisma = getPrismaClient();
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.masterProduct.update({
        where: { id },
        data: {
          status: 'ARCHIVED',
          archivedAt: new Date(),
          updatedById: userId,
        },
        include: masterProductDetailInclude,
      });

      await audit(tx, req, {
        entityType: 'master_product',
        entityId: id,
        action: 'archive',
        diff: { route: 'DELETE /master-products/:id' },
      });

      return updated;
    });

    await enqueueProjectionAfterMutation({ masterProductId: id, action: 'archive' });
    sendSuccess(res, serializeMasterProduct(product));
  })
);

adminMasterCatalogRouter.post(
  '/:id/publish',
  validateBody(masterProductPublishSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as MasterProductPublishInput;
    const id = parseBigIntId(req.params.id);
    const userId = actorId(req);
    const prisma = getPrismaClient();
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.masterProduct.findUnique({
        where: { id },
        include: masterProductDetailInclude,
      });

      if (!existing) throw notFound('Master product not found.', { id: id.toString() });
      if (existing.status === 'PUBLISHED') return existing;
      if (existing.status !== 'PENDING_REVIEW') {
        throw badRequest('Only pending_review master products can be published.', {
          id: id.toString(),
          status: existing.status,
        });
      }
      if (existing.createdById === userId) {
        throw badRequest('Two-person publish is required for new master products.', {
          id: id.toString(),
        });
      }

      const blockers = await publishBlockers(tx, existing);
      if (blockers.length > 0) {
        throw badRequest('Master product is not publishable.', { id: id.toString(), blockers });
      }

      const publishedAt = new Date();
      const pricingSnapshot = await buildMasterPricingSnapshotUpdate(tx, id, publishedAt);
      const updated = await tx.masterProduct.update({
        where: { id },
        data: {
          ...pricingSnapshot.data,
          status: 'PUBLISHED',
          publishedAt,
          archivedAt: null,
          updatedById: userId,
        },
        include: masterProductDetailInclude,
      });

      await audit(tx, req, {
        entityType: 'master_product',
        entityId: id,
        action: 'publish',
        diff: {
          before: { status: existing.status },
          after: {
            status: 'published',
            pricedSellCents: pricingSnapshot.snapshot?.sellPriceCents ?? null,
          },
          reason: input.reason,
        },
      });

      return updated;
    });

    await enqueueProjectionAfterMutation({ masterProductId: id, action: 'publish' });
    sendSuccess(res, serializeMasterProduct(product));
  })
);

adminMasterCatalogRouter.post(
  '/:id/archive',
  validateBody(masterProductArchiveSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as MasterProductArchiveInput;
    const id = parseBigIntId(req.params.id);
    const userId = actorId(req);
    const prisma = getPrismaClient();
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.masterProduct.findUnique({ where: { id } });
      if (!existing) throw notFound('Master product not found.', { id: id.toString() });

      const updated = await tx.masterProduct.update({
        where: { id },
        data: {
          status: 'ARCHIVED',
          archivedAt: existing.archivedAt ?? new Date(),
          updatedById: userId,
        },
        include: masterProductDetailInclude,
      });

      await audit(tx, req, {
        entityType: 'master_product',
        entityId: id,
        action: 'archive',
        diff: { before: { status: existing.status }, after: { status: 'archived' }, reason: input.reason },
      });

      return updated;
    });

    await enqueueProjectionAfterMutation({ masterProductId: id, action: 'archive' });
    sendSuccess(res, serializeMasterProduct(product));
  })
);

adminMasterCatalogRouter.post(
  '/:id/reprice',
  validateBody(masterProductRepriceSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as MasterProductRepriceInput;
    const id = parseBigIntId(req.params.id);
    const userId = actorId(req);
    const prisma = getPrismaClient();
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.masterProduct.findUnique({ where: { id } });
      if (!existing) throw notFound('Master product not found.', { id: id.toString() });

      const snapshot = await repriceMasterInTransaction(tx, {
        masterProductId: id,
        updatedById: userId,
      });

      await audit(tx, req, {
        entityType: 'master_product',
        entityId: id,
        action: 'reprice',
        diff: {
          before: {
            pricedSellCents: existing.pricedSellCents?.toString() ?? null,
            pricedAt: existing.pricedAt,
          },
          after: {
            pricedSellCents: snapshot?.sellPriceCents ?? null,
            pricedAt: snapshot?.pricedAt ?? null,
            sourceCurrency: snapshot?.sourceCurrency ?? null,
            sourceCostCents: snapshot?.sourceCostCents ?? null,
            fxRateToAed: snapshot?.fxRateToAed ?? null,
            marginBps: snapshot?.marginBps ?? null,
          },
          reason: input.reason,
        },
      });

      const updated = await tx.masterProduct.findUnique({
        where: { id },
        include: masterProductDetailInclude,
      });

      if (!updated) throw notFound('Master product not found after reprice.', { id: id.toString() });
      return updated;
    });

    await enqueueProjectionAfterMutation({ masterProductId: id, action: 'reprice' });
    sendSuccess(res, serializeMasterProduct(product));
  })
);

adminMasterCatalogRouter.post(
  '/:id/offers',
  validateBody(vendorOfferCreateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as VendorOfferCreateInput;
    const productId = parseBigIntId(req.params.id);
    const prisma = getPrismaClient();
    const offer = await prisma.$transaction(async (tx) => {
      const created = await tx.vendorOffer.create({
        data: {
          productId,
          vendorId: parseBigIntId(input.vendorId, 'vendorId'),
          vendorSku: input.vendorSku,
          vendorUrl: input.vendorUrl,
          priceCents: input.priceCents,
          currency: input.currency,
          inStock: input.inStock,
          lastSeenAt: input.lastSeenAt ?? new Date(),
          status: input.status,
          confidence: input.confidence,
          notes: input.notes,
        },
      });

      if (input.priceCents !== undefined && input.priceCents !== null) {
        await tx.priceHistory.create({
          data: {
            offerId: created.id,
            priceCents: input.priceCents,
            currency: input.currency,
            inStock: input.inStock,
          },
        });
      }

      await audit(tx, req, {
        entityType: 'vendor_offer',
        entityId: created.id,
        action: 'create',
        diff: { after: input },
      });

      return created;
    });

    await enqueueProjectionAfterMutation({ masterProductId: productId, action: 'offer.create' });
    sendSuccess(res, serializeOffer(offer), 201);
  })
);

adminMasterCatalogRouter.patch(
  '/offers/:offerId',
  validateBody(vendorOfferUpdateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as VendorOfferUpdateInput;
    const offerId = parseBigIntId(req.params.offerId, 'offerId');
    const prisma = getPrismaClient();
    const offer = await prisma.$transaction(async (tx) => {
      const existing = await tx.vendorOffer.findUnique({ where: { id: offerId } });
      if (!existing) throw notFound('Vendor offer not found.', { id: offerId.toString() });

      const updated = await tx.vendorOffer.update({
        where: { id: offerId },
        data: {
          vendorId: input.vendorId ? parseBigIntId(input.vendorId, 'vendorId') : undefined,
          vendorSku: input.vendorSku,
          vendorUrl: input.vendorUrl,
          priceCents: input.priceCents,
          currency: input.currency,
          inStock: input.inStock,
          lastSeenAt: input.lastSeenAt,
          status: input.status,
          confidence: input.confidence,
          notes: input.notes,
        },
      });

      if (input.priceCents !== undefined && input.priceCents !== null) {
        await tx.priceHistory.create({
          data: {
            offerId,
            priceCents: input.priceCents,
            currency: input.currency ?? existing.currency,
            inStock: input.inStock ?? existing.inStock,
          },
        });
      }

      await audit(tx, req, {
        entityType: 'vendor_offer',
        entityId: offerId,
        action: 'update',
        diff: { before: existing, after: input },
      });

      return updated;
    });

    await enqueueProjectionAfterMutation({ masterProductId: offer.productId, action: 'offer.update' });
    sendSuccess(res, serializeOffer(offer));
  })
);

adminMasterCatalogRouter.delete(
  '/offers/:offerId',
  asyncHandler(async (req, res) => {
    const offerId = parseBigIntId(req.params.offerId, 'offerId');
    const prisma = getPrismaClient();
    const offer = await prisma.$transaction(async (tx) => {
      const updated = await tx.vendorOffer.update({
        where: { id: offerId },
        data: { status: 'DISCONTINUED' },
      });

      await audit(tx, req, {
        entityType: 'vendor_offer',
        entityId: offerId,
        action: 'archive',
        diff: { after: { status: 'discontinued' } },
      });

      return updated;
    });

    await enqueueProjectionAfterMutation({ masterProductId: offer.productId, action: 'offer.archive' });
    sendSuccess(res, serializeOffer(offer));
  })
);

adminMasterCatalogRouter.post(
  '/:id/images',
  validateBody(catalogProductImageCreateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as CatalogProductImageCreateInput;
    const productId = parseBigIntId(req.params.id);
    const prisma = getPrismaClient();
    const image = await prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.catalogProductImage.updateMany({
          where: { productId },
          data: { isPrimary: false },
        });
      }

      const created = await tx.catalogProductImage.create({
        data: {
          productId,
          storageKey: input.storageKey,
          width: input.width,
          height: input.height,
          mimeType: input.mimeType,
          altText: input.altText,
          isPrimary: input.isPrimary,
          sortOrder: input.sortOrder,
          sourceVendorId: input.sourceVendorId ? parseBigIntId(input.sourceVendorId, 'sourceVendorId') : null,
        },
      });

      await audit(tx, req, {
        entityType: 'product_image',
        entityId: created.id,
        action: 'create',
        diff: { after: input },
      });

      return created;
    });

    await enqueueProjectionAfterMutation({ masterProductId: productId, action: 'image.create' });
    sendSuccess(res, serializeImage(image), 201);
  })
);

adminMasterCatalogRouter.patch(
  '/images/:imageId',
  validateBody(catalogProductImageUpdateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as CatalogProductImageUpdateInput;
    const imageId = parseBigIntId(req.params.imageId, 'imageId');
    const prisma = getPrismaClient();
    const image = await prisma.$transaction(async (tx) => {
      const existing = await tx.catalogProductImage.findUnique({ where: { id: imageId } });
      if (!existing) throw notFound('Product image not found.', { id: imageId.toString() });

      if (input.isPrimary) {
        await tx.catalogProductImage.updateMany({
          where: { productId: existing.productId },
          data: { isPrimary: false },
        });
      }

      const updated = await tx.catalogProductImage.update({
        where: { id: imageId },
        data: {
          storageKey: input.storageKey,
          width: input.width,
          height: input.height,
          mimeType: input.mimeType,
          altText: input.altText,
          isPrimary: input.isPrimary,
          sortOrder: input.sortOrder,
          sourceVendorId: optionalBigIntId(input.sourceVendorId, 'sourceVendorId'),
        },
      });

      await audit(tx, req, {
        entityType: 'product_image',
        entityId: imageId,
        action: 'update',
        diff: { before: existing, after: input },
      });

      return updated;
    });

    await enqueueProjectionAfterMutation({ masterProductId: image.productId, action: 'image.update' });
    sendSuccess(res, serializeImage(image));
  })
);

adminMasterCatalogRouter.delete(
  '/images/:imageId',
  asyncHandler(async (req, res) => {
    const imageId = parseBigIntId(req.params.imageId, 'imageId');
    const prisma = getPrismaClient();
    const image = await prisma.$transaction(async (tx) => {
      const existing = await tx.catalogProductImage.delete({ where: { id: imageId } });

      await audit(tx, req, {
        entityType: 'product_image',
        entityId: imageId,
        action: 'delete',
        diff: { before: existing },
      });

      return existing;
    });

    await enqueueProjectionAfterMutation({ masterProductId: image.productId, action: 'image.delete' });
    sendSuccess(res, serializeImage(image));
  })
);
