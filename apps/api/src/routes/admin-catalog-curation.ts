import { getPrismaClient } from '@caracal/db';
import type { Prisma } from '@prisma/client';
import { Router, type Request, type Router as ExpressRouter } from 'express';
import { z } from 'zod';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { enqueueCatalogReconciliationJob } from '../lib/catalog/queues.js';
import {
  getAdminAuditVisibility,
  getAdminReviewDashboard,
  getImageIntegrityReport,
  getIngestionObservability,
  getPricingWorkflow,
  getReconciliationReport,
  serializeCuratedProductPrice,
} from '../lib/catalog/operator-tooling.js';
import { getProjectionRuntimeHealth } from '../lib/catalog/projection-health.js';
import { badRequest, notFound } from '../lib/errors.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { validateBody } from '../middleware/validate.js';

export const adminCatalogCurationRouter: ExpressRouter = Router();

const curatedPriceSchema = z.object({
  offerId: z.string().trim().regex(/^\d+$/).nullable().optional(),
  priceCents: z.coerce.bigint().nonnegative(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  reason: z.string().trim().min(1).max(2000).nullable().optional(),
});

const reconciliationEnqueueSchema = z
  .object({
    type: z
      .enum(['projection-consistency', 'search-count', 'full-reconcile'])
      .default('full-reconcile'),
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .default({});
const lookupQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

function parseBigIntId(value: string, label = 'id'): bigint {
  try {
    return BigInt(value);
  } catch {
    throw badRequest(`Invalid ${label}.`, { [label]: value });
  }
}

function optionalBigIntId(value: unknown, label: string): bigint | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return parseBigIntId(value, label);
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

adminCatalogCurationRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await getAdminReviewDashboard());
  })
);

adminCatalogCurationRouter.get(
  '/projection-health',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'private, no-store');
    sendSuccess(res, await getProjectionRuntimeHealth());
  })
);

adminCatalogCurationRouter.get(
  '/lookups/categories',
  asyncHandler(async (req, res) => {
    const query = lookupQuerySchema.parse(req.query);
    const prisma = getPrismaClient();
    const rows = await prisma.category.findMany({
      where: query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: [{ name: 'asc' }],
      take: query.limit,
      select: { id: true, slug: true, name: true },
    });

    res.set('Cache-Control', 'private, max-age=30');
    sendSuccess(
      res,
      rows.map((row) => ({
        id: row.id.toString(),
        slug: row.slug,
        name: row.name,
      }))
    );
  })
);

adminCatalogCurationRouter.get(
  '/lookups/manufacturers',
  asyncHandler(async (req, res) => {
    const query = lookupQuerySchema.parse(req.query);
    const prisma = getPrismaClient();
    const rows = await prisma.manufacturer.findMany({
      where: query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: [{ name: 'asc' }],
      take: query.limit,
      select: { id: true, slug: true, name: true },
    });

    res.set('Cache-Control', 'private, max-age=30');
    sendSuccess(
      res,
      rows.map((row) => ({
        id: row.id.toString(),
        slug: row.slug,
        name: row.name,
      }))
    );
  })
);

adminCatalogCurationRouter.get(
  '/images/integrity',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await getImageIntegrityReport());
  })
);

adminCatalogCurationRouter.get(
  '/pricing/:productId',
  asyncHandler(async (req, res) => {
    const report = await getPricingWorkflow(parseBigIntId(req.params.productId, 'productId'));
    if (!report) {
      throw notFound('Master product not found.', { id: req.params.productId });
    }

    sendSuccess(res, report);
  })
);

adminCatalogCurationRouter.post(
  '/pricing/:productId/curate',
  validateBody(curatedPriceSchema),
  asyncHandler(async (req, res) => {
    const productId = parseBigIntId(req.params.productId, 'productId');
    const input = req.body as z.infer<typeof curatedPriceSchema>;
    const selectedById = actorId(req);
    const prisma = getPrismaClient();
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.masterProduct.findUnique({
        where: { id: productId },
        select: { id: true, slug: true },
      });
      if (!product) throw notFound('Master product not found.', { id: productId.toString() });

      const offerId = input.offerId ? parseBigIntId(input.offerId, 'offerId') : null;
      if (offerId) {
        const offer = await tx.vendorOffer.findUnique({
          where: { id: offerId },
          select: { id: true, productId: true },
        });
        if (!offer || offer.productId !== productId) {
          throw badRequest('Selected vendor offer must belong to the master product.', {
            productId: productId.toString(),
            offerId: offerId.toString(),
          });
        }
      }

      const price = await tx.curatedProductPrice.upsert({
        where: { productId },
        create: {
          productId,
          selectedOfferId: offerId,
          priceCents: input.priceCents,
          currency: input.currency,
          reason: input.reason,
          selectedById,
        },
        update: {
          selectedOfferId: offerId,
          priceCents: input.priceCents,
          currency: input.currency,
          reason: input.reason,
          selectedById,
          selectedAt: new Date(),
        },
      });

      await audit(tx, req, {
        entityType: 'curated_product_price',
        entityId: price.id,
        action: 'select_curated_price',
        diff: {
          productId: productId.toString(),
          selectedOfferId: offerId?.toString() ?? null,
          priceCents: input.priceCents.toString(),
          currency: input.currency,
          reason: input.reason ?? null,
        },
      });

      return price;
    });

    sendSuccess(res, serializeCuratedProductPrice(result));
  })
);

adminCatalogCurationRouter.get(
  '/observability',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await getIngestionObservability());
  })
);

adminCatalogCurationRouter.get(
  '/reconciliation',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await getReconciliationReport());
  })
);

adminCatalogCurationRouter.post(
  '/reconciliation/enqueue',
  validateBody(reconciliationEnqueueSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof reconciliationEnqueueSchema>;
    const job = await enqueueCatalogReconciliationJob({
      type: input.type,
      reason: input.reason ?? `admin:${actorId(req)}`,
    });

    sendSuccess(
      res,
      {
        queued: true,
        jobId: job.id,
        type: input.type,
      },
      202
    );
  })
);

adminCatalogCurationRouter.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);
    const entityType =
      typeof req.query.entityType === 'string' && req.query.entityType.trim()
        ? req.query.entityType.trim()
        : undefined;
    const entityId = optionalBigIntId(req.query.entityId, 'entityId');

    sendSuccess(res, await getAdminAuditVisibility({ entityType, entityId, limit }));
  })
);

adminCatalogCurationRouter.get(
  '/audit/review/:id',
  asyncHandler(async (req, res) => {
    const reviewId = parseBigIntId(req.params.id);
    sendSuccess(
      res,
      await getAdminAuditVisibility({
        entityType: 'review_queue',
        entityId: reviewId,
        limit: 100,
      })
    );
  })
);
