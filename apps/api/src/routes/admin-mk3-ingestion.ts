import { getPrismaClient } from '@caracal/db';
import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { enqueueCatalogIngestionJob } from '../lib/catalog/queues.js';
import {
  ensureMk3VendorSource,
  summarizeMk3IngestionRun,
  type Mk3RunSummary,
} from '../lib/catalog/mk3/ingestion.js';
import { notFound } from '../lib/errors.js';
import { validateBody } from '../middleware/validate.js';

export const adminMk3IngestionRouter: ExpressRouter = Router();

const mk3EnqueueSchema = z.object({
  startUrls: z.array(z.string().trim().url()).min(1).max(20).optional(),
  maxPages: z.coerce.number().int().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  fullCrawl: z.boolean().optional(),
});

function emptySummary(): Mk3RunSummary {
  return {
    ingestionRunId: '',
    importedCount: 0,
    failedCount: 0,
    reviewQueueCount: 0,
    exactMatchCount: 0,
    duplicateRawCount: 0,
    rawImageCount: 0,
  };
}

adminMk3IngestionRouter.post(
  '/enqueue',
  validateBody(mk3EnqueueSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof mk3EnqueueSchema>;
    const vendor = await ensureMk3VendorSource();
    const job = await enqueueCatalogIngestionJob({
      vendorSourceId: vendor.id.toString(),
      requestedBy: req.auth?.userId,
      trigger: 'manual',
      startUrls: input.startUrls,
      maxPages: input.maxPages,
      limit: input.limit,
      fullCrawl: input.fullCrawl,
    });

    sendSuccess(
      res,
      {
        queued: true,
        jobId: job.id,
        vendorSourceId: vendor.id.toString(),
      },
      202
    );
  })
);

adminMk3IngestionRouter.get(
  '/summary/latest',
  asyncHandler(async (_req, res) => {
    const prisma = getPrismaClient();
    const latest = await prisma.ingestionRun.findFirst({
      where: { vendor: { slug: 'mk3' } },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });

    if (!latest) {
      sendSuccess(res, emptySummary());
      return;
    }

    sendSuccess(res, await summarizeMk3IngestionRun(latest.id.toString()));
  })
);

adminMk3IngestionRouter.get(
  '/runs/:id/summary',
  asyncHandler(async (req, res) => {
    try {
      sendSuccess(res, await summarizeMk3IngestionRun(req.params.id));
    } catch (error) {
      throw notFound('MK3 ingestion run not found.', {
        id: req.params.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  })
);
