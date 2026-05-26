import { getPrismaClient } from '@caracal/db';
import type { Prisma } from '@prisma/client';
import { Router, type Request, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import {
  enqueueCatalogProjectionJob,
  enqueueCatalogSearchIndexJob,
} from '../lib/catalog/queues.js';
import { badRequest, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { validateBody } from '../middleware/validate.js';
import {
  masterProductArchiveSchema,
  masterProductPublishSchema,
  type MasterProductArchiveInput,
  type MasterProductPublishInput,
} from '../schemas/master-catalog.js';

export const adminMasterCatalogRouter: ExpressRouter = Router();

function parseMasterProductId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw badRequest('Invalid master product id.', { id: value });
  }
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

function serializeMasterProduct(product: {
  id: bigint;
  publicId: string;
  slug: string;
  sku: string | null;
  name: string;
  status: string;
  fingerprint: string;
  publishedAt: Date | null;
  archivedAt: Date | null;
  updatedAt: Date;
}) {
  return {
    id: product.id.toString(),
    publicId: product.publicId,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    status: product.status,
    fingerprint: product.fingerprint,
    publishedAt: product.publishedAt,
    archivedAt: product.archivedAt,
    updatedAt: product.updatedAt,
  };
}

async function publishBlockers(
  tx: Prisma.TransactionClient,
  product: {
    id: bigint;
    slug: string;
    manufacturerSlug: string;
    manufacturerName: string;
    categoryId: bigint;
    longDescriptionMd: string | null;
  }
): Promise<string[]> {
  const [primaryImages, activeOffers] = await Promise.all([
    tx.catalogProductImage.count({
      where: {
        productId: product.id,
        isPrimary: true,
      },
    }),
    tx.vendorOffer.count({
      where: {
        productId: product.id,
        status: 'ACTIVE',
      },
    }),
  ]);
  const blockers: string[] = [];

  if (!product.slug.trim()) blockers.push('slug');
  if (!product.manufacturerSlug.trim()) blockers.push('manufacturer_slug');
  if (!product.manufacturerName.trim()) blockers.push('manufacturer_name');
  if (!product.categoryId) blockers.push('category_id');
  if (!product.longDescriptionMd?.trim()) blockers.push('long_description_md');
  if (primaryImages < 1) blockers.push('primary_image');
  if (activeOffers < 1) blockers.push('active_offer');

  return blockers;
}

async function enqueueProjectionAfterMutation(input: {
  masterProductId: bigint;
  action: 'publish' | 'archive';
}): Promise<void> {
  try {
    await Promise.all([
      enqueueCatalogProjectionJob({
        type: 'project-product',
        masterProductId: input.masterProductId.toString(),
        reason: `admin.${input.action}`,
      }),
      enqueueCatalogSearchIndexJob({
        type: input.action === 'publish' ? 'upsert' : 'delete',
        masterProductId: input.masterProductId.toString(),
        reason: `admin.${input.action}`,
      }),
    ]);
  } catch (error) {
    logger.error(
      { err: error, masterProductId: input.masterProductId.toString(), action: input.action },
      'catalog projection enqueue failed after admin mutation'
    );
  }
}

adminMasterCatalogRouter.post(
  '/:id/publish',
  validateBody(masterProductPublishSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as MasterProductPublishInput;
    const id = parseMasterProductId(req.params.id);
    const userId = actorId(req);
    const prisma = getPrismaClient();
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.masterProduct.findUnique({
        where: { id },
        select: {
          id: true,
          publicId: true,
          slug: true,
          sku: true,
          name: true,
          status: true,
          fingerprint: true,
          manufacturerSlug: true,
          manufacturerName: true,
          categoryId: true,
          longDescriptionMd: true,
          createdById: true,
          publishedAt: true,
          archivedAt: true,
          updatedAt: true,
        },
      });

      if (!existing) {
        throw notFound('Master product not found.', { id: id.toString() });
      }

      if (existing.status === 'PUBLISHED') {
        return existing;
      }

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

      const updated = await tx.masterProduct.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          archivedAt: null,
          updatedById: userId,
        },
        select: {
          id: true,
          publicId: true,
          slug: true,
          sku: true,
          name: true,
          status: true,
          fingerprint: true,
          publishedAt: true,
          archivedAt: true,
          updatedAt: true,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          userId,
          entityType: 'master_product',
          entityId: id,
          action: 'publish',
          diff: toPrismaJson({
            before: { status: existing.status, publishedAt: existing.publishedAt },
            after: { status: 'published', publishedAt: updated.publishedAt },
            reason: input.reason,
          }),
          requestId: requestId(req),
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
    const id = parseMasterProductId(req.params.id);
    const userId = actorId(req);
    const prisma = getPrismaClient();
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.masterProduct.findUnique({
        where: { id },
        select: {
          id: true,
          publicId: true,
          slug: true,
          sku: true,
          name: true,
          status: true,
          fingerprint: true,
          publishedAt: true,
          archivedAt: true,
          updatedAt: true,
        },
      });

      if (!existing) {
        throw notFound('Master product not found.', { id: id.toString() });
      }

      const updated = await tx.masterProduct.update({
        where: { id },
        data: {
          status: 'ARCHIVED',
          archivedAt: existing.archivedAt ?? new Date(),
          updatedById: userId,
        },
        select: {
          id: true,
          publicId: true,
          slug: true,
          sku: true,
          name: true,
          status: true,
          fingerprint: true,
          publishedAt: true,
          archivedAt: true,
          updatedAt: true,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          userId,
          entityType: 'master_product',
          entityId: id,
          action: 'archive',
          diff: toPrismaJson({
            before: { status: existing.status, archivedAt: existing.archivedAt },
            after: { status: 'archived', archivedAt: updated.archivedAt },
            reason: input.reason,
          }),
          requestId: requestId(req),
        },
      });

      return updated;
    });

    await enqueueProjectionAfterMutation({ masterProductId: id, action: 'archive' });
    sendSuccess(res, serializeMasterProduct(product));
  })
);
