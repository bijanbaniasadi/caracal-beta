import { getPrismaClient } from '@caracal/db';
import type { Prisma } from '@prisma/client';
import { Router, type Request, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { enqueueCatalogProjectionJob } from '../lib/catalog/queues.js';
import { badRequest, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { validateBody } from '../middleware/validate.js';
import {
  reviewQueueAttachSchema,
  reviewQueueCreateSchema,
  reviewQueueListQuerySchema,
  reviewQueueRejectSchema,
  type ReviewQueueAttachInput,
  type ReviewQueueCreateInput,
  type ReviewQueueListQuery,
  type ReviewQueueRejectInput,
} from '../schemas/master-catalog.js';

export const adminReviewQueueRouter: ExpressRouter = Router();

const reviewQueueInclude = {
  rawProduct: {
    include: {
      vendor: true,
      ingestionRun: true,
    },
  },
  suggestedProduct: {
    select: {
      id: true,
      publicId: true,
      slug: true,
      name: true,
      status: true,
      fingerprint: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
  resolvedBy: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
} satisfies Prisma.ReviewQueueInclude;

type ReviewQueueDetail = Prisma.ReviewQueueGetPayload<{ include: typeof reviewQueueInclude }>;

function parseBigIntId(value: string, label = 'id'): bigint {
  try {
    return BigInt(value);
  } catch {
    throw badRequest(`Invalid ${label}.`, { [label]: value });
  }
}

function actorId(req: Request): string {
  if (!req.auth?.userId) {
    throw badRequest('Admin user id is required.');
  }

  return req.auth.userId;
}

function requestId(req: Request): string | undefined {
  const header = req.get('x-request-id');
  return header && header.trim().length > 0 ? header : undefined;
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
): Promise<void> {
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

async function enqueueProjection(masterProductId: bigint, reason: string): Promise<void> {
  try {
    await enqueueCatalogProjectionJob({
      type: 'project-product',
      masterProductId: masterProductId.toString(),
      reason,
    });
  } catch (error) {
    logger.error(
      { err: error, masterProductId: masterProductId.toString(), reason },
      'catalog projection enqueue failed after review queue mutation'
    );
  }
}

function serializeReviewItem(item: ReviewQueueDetail) {
  return {
    id: item.id.toString(),
    rawProductId: item.rawProductId.toString(),
    suggestedProductId: item.suggestedProductId?.toString() ?? null,
    suggestedConfidence: item.suggestedConfidence?.toNumber() ?? null,
    priority: item.priority,
    assignedTo: item.assignedTo,
    resolvedAt: item.resolvedAt,
    resolvedBy: item.resolvedBy,
    resolvedAction: item.resolvedAction,
    notes: item.notes,
    createdAt: item.createdAt,
    rawProduct: {
      id: item.rawProduct.id.toString(),
      vendorId: item.rawProduct.vendorId.toString(),
      vendorSlug: item.rawProduct.vendor.slug,
      vendorName: item.rawProduct.vendor.name,
      ingestionRunId: item.rawProduct.ingestionRunId.toString(),
      vendorUrl: item.rawProduct.vendorUrl,
      vendorSku: item.rawProduct.vendorSku,
      rawName: item.rawProduct.rawName,
      rawDescription: item.rawProduct.rawDescription,
      rawPriceText: item.rawProduct.rawPriceText,
      parsedPriceCents: item.rawProduct.parsedPriceCents?.toString() ?? null,
      parsedCurrency: item.rawProduct.parsedCurrency,
      parsedInStock: item.rawProduct.parsedInStock,
      rawSpecs: item.rawProduct.rawSpecs,
      rawImageUrls: item.rawProduct.rawImageUrls,
      fingerprint: item.rawProduct.fingerprint,
      matchStatus: item.rawProduct.matchStatus,
      matchConfidence: item.rawProduct.matchConfidence?.toNumber() ?? null,
      scrapedAt: item.rawProduct.scrapedAt,
    },
    suggestedProduct: item.suggestedProduct
      ? {
          id: item.suggestedProduct.id.toString(),
          publicId: item.suggestedProduct.publicId,
          slug: item.suggestedProduct.slug,
          name: item.suggestedProduct.name,
          status: item.suggestedProduct.status,
          fingerprint: item.suggestedProduct.fingerprint,
        }
      : null,
  };
}

function parseListQuery(req: Request): ReviewQueueListQuery {
  return reviewQueueListQuerySchema.parse(req.query);
}

function ensureOpenReview(item: ReviewQueueDetail): void {
  if (item.resolvedAt) {
    throw badRequest('Review queue item is already resolved.', {
      id: item.id.toString(),
      resolvedAt: item.resolvedAt,
      resolvedAction: item.resolvedAction,
    });
  }
}

function offerDataFromRawProduct(
  rawProduct: ReviewQueueDetail['rawProduct'],
  productId: bigint,
  confidence: number | undefined,
  notes: string | null | undefined
) {
  return {
    productId,
    vendorId: rawProduct.vendorId,
    vendorSku: rawProduct.vendorSku,
    vendorUrl: rawProduct.vendorUrl,
    priceCents: rawProduct.parsedPriceCents,
    currency: rawProduct.parsedCurrency ?? 'USD',
    inStock: rawProduct.parsedInStock,
    lastSeenAt: rawProduct.scrapedAt,
    status: 'ACTIVE' as const,
    confidence: confidence ?? 1,
    notes,
  };
}

adminReviewQueueRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req);
    const prisma = getPrismaClient();
    const where: Prisma.ReviewQueueWhereInput =
      query.status === 'open'
        ? { resolvedAt: null }
        : query.status === 'resolved'
          ? { resolvedAt: { not: null } }
          : {};
    const rows = await prisma.reviewQueue.findMany({
      where,
      include: reviewQueueInclude,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: parseBigIntId(query.cursor) }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const pageItems = hasMore ? rows.slice(0, query.limit) : rows;

    sendSuccess(res, pageItems.map(serializeReviewItem), 200, {
      pagination: {
        limit: query.limit,
        hasMore,
        nextCursor: hasMore ? pageItems[pageItems.length - 1]?.id.toString() : null,
      },
    });
  })
);

adminReviewQueueRouter.post(
  '/:id/attach',
  validateBody(reviewQueueAttachSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ReviewQueueAttachInput;
    const id = parseBigIntId(req.params.id);
    const masterProductId = parseBigIntId(input.masterProductId, 'masterProductId');
    const userId = actorId(req);
    const prisma = getPrismaClient();
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.reviewQueue.findUnique({
        where: { id },
        include: reviewQueueInclude,
      });

      if (!existing) throw notFound('Review queue item not found.', { id: id.toString() });
      ensureOpenReview(existing);

      const master = await tx.masterProduct.findUnique({
        where: { id: masterProductId },
        select: { id: true },
      });
      if (!master) {
        throw notFound('Master product not found.', { id: masterProductId.toString() });
      }

      const offer = await tx.vendorOffer.upsert({
        where: {
          vendorId_vendorUrl: {
            vendorId: existing.rawProduct.vendorId,
            vendorUrl: existing.rawProduct.vendorUrl,
          },
        },
        create: offerDataFromRawProduct(
          existing.rawProduct,
          masterProductId,
          input.confidence,
          input.notes
        ),
        update: offerDataFromRawProduct(
          existing.rawProduct,
          masterProductId,
          input.confidence,
          input.notes
        ),
      });

      if (existing.rawProduct.parsedPriceCents !== null) {
        await tx.priceHistory.create({
          data: {
            offerId: offer.id,
            priceCents: existing.rawProduct.parsedPriceCents,
            currency: existing.rawProduct.parsedCurrency ?? offer.currency,
            inStock: existing.rawProduct.parsedInStock,
            observedAt: existing.rawProduct.scrapedAt,
          },
        });
      }

      await tx.vendorRawProduct.update({
        where: { id: existing.rawProductId },
        data: {
          matchedProductId: masterProductId,
          matchStatus: 'ADMIN_MATCHED',
          matchConfidence: input.confidence ?? existing.suggestedConfidence ?? 1,
        },
      });

      const updated = await tx.reviewQueue.update({
        where: { id },
        data: {
          suggestedProductId: masterProductId,
          suggestedConfidence: input.confidence ?? existing.suggestedConfidence,
          resolvedAt: new Date(),
          resolvedById: userId,
          resolvedAction: 'ATTACH_TO_MASTER',
          notes: input.notes,
        },
        include: reviewQueueInclude,
      });

      await audit(tx, req, {
        entityType: 'review_queue',
        entityId: id,
        action: 'attach_to_master',
        diff: {
          rawProductId: existing.rawProductId.toString(),
          masterProductId: masterProductId.toString(),
          offerId: offer.id.toString(),
        },
      });

      return updated;
    });

    await enqueueProjection(masterProductId, 'review-queue.attach');
    sendSuccess(res, serializeReviewItem(item));
  })
);

adminReviewQueueRouter.post(
  '/:id/create',
  validateBody(reviewQueueCreateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ReviewQueueCreateInput;
    const id = parseBigIntId(req.params.id);
    const userId = actorId(req);

    if (input.status === 'PUBLISHED') {
      throw badRequest('Review queue create cannot publish a master product.', {
        requestedStatus: input.status,
      });
    }

    const prisma = getPrismaClient();
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.reviewQueue.findUnique({
        where: { id },
        include: reviewQueueInclude,
      });

      if (!existing) throw notFound('Review queue item not found.', { id: id.toString() });
      ensureOpenReview(existing);

      const product = await tx.masterProduct.create({
        data: {
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
        },
      });

      let offerId: bigint | null = null;
      if (input.createOffer) {
        const offer = await tx.vendorOffer.upsert({
          where: {
            vendorId_vendorUrl: {
              vendorId: existing.rawProduct.vendorId,
              vendorUrl: existing.rawProduct.vendorUrl,
            },
          },
          create: offerDataFromRawProduct(existing.rawProduct, product.id, 1, input.notes),
          update: offerDataFromRawProduct(existing.rawProduct, product.id, 1, input.notes),
        });
        offerId = offer.id;

        if (existing.rawProduct.parsedPriceCents !== null) {
          await tx.priceHistory.create({
            data: {
              offerId: offer.id,
              priceCents: existing.rawProduct.parsedPriceCents,
              currency: existing.rawProduct.parsedCurrency ?? offer.currency,
              inStock: existing.rawProduct.parsedInStock,
              observedAt: existing.rawProduct.scrapedAt,
            },
          });
        }
      }

      await tx.vendorRawProduct.update({
        where: { id: existing.rawProductId },
        data: {
          matchedProductId: product.id,
          matchStatus: 'ADMIN_MATCHED',
          matchConfidence: 1,
        },
      });

      const updated = await tx.reviewQueue.update({
        where: { id },
        data: {
          suggestedProductId: product.id,
          suggestedConfidence: 1,
          resolvedAt: new Date(),
          resolvedById: userId,
          resolvedAction: 'CREATE_MASTER',
          notes: input.notes,
        },
        include: reviewQueueInclude,
      });

      await audit(tx, req, {
        entityType: 'review_queue',
        entityId: id,
        action: 'create_master',
        diff: {
          rawProductId: existing.rawProductId.toString(),
          masterProductId: product.id.toString(),
          offerId: offerId?.toString() ?? null,
        },
      });

      return { item: updated, productId: product.id };
    });

    await enqueueProjection(result.productId, 'review-queue.create');
    sendSuccess(res, serializeReviewItem(result.item), 201);
  })
);

adminReviewQueueRouter.post(
  '/:id/reject',
  validateBody(reviewQueueRejectSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ReviewQueueRejectInput;
    const id = parseBigIntId(req.params.id);
    const userId = actorId(req);
    const prisma = getPrismaClient();
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.reviewQueue.findUnique({
        where: { id },
        include: reviewQueueInclude,
      });

      if (!existing) throw notFound('Review queue item not found.', { id: id.toString() });
      ensureOpenReview(existing);

      await tx.vendorRawProduct.update({
        where: { id: existing.rawProductId },
        data: {
          matchStatus: 'REJECTED',
          matchConfidence: null,
        },
      });

      const updated = await tx.reviewQueue.update({
        where: { id },
        data: {
          resolvedAt: new Date(),
          resolvedById: userId,
          resolvedAction: 'REJECT',
          notes: input.reason,
        },
        include: reviewQueueInclude,
      });

      await audit(tx, req, {
        entityType: 'review_queue',
        entityId: id,
        action: 'reject',
        diff: {
          rawProductId: existing.rawProductId.toString(),
          reason: input.reason,
        },
      });

      return updated;
    });

    sendSuccess(res, serializeReviewItem(item));
  })
);
