import { getPrismaClient } from '@caracal/db';
import type { Prisma } from '@prisma/client';
import { Router, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { notFound } from '../lib/errors.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { validateBody } from '../middleware/validate.js';
import {
  updateEcuPatcherAccessSchema,
  type UpdateEcuPatcherAccessInput,
} from '../schemas/ecu-patcher.js';

export const adminEcuPatcherRouter: ExpressRouter = Router();

const accessInclude = {
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true,
      workshopName: true,
      createdAt: true,
    },
  },
} satisfies Prisma.EcuPatcherAccessInclude;

const jobInclude = {
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true,
      workshopName: true,
    },
  },
  upload: {
    select: {
      id: true,
      originalFileName: true,
      status: true,
      createdAt: true,
    },
  },
} satisfies Prisma.EcuPatcherJobInclude;

function parseLimit(value: unknown, fallback = 50): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(raw ?? fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 100);
}

function serializeAccess(
  access: Prisma.EcuPatcherAccessGetPayload<{ include: typeof accessInclude }>
) {
  return {
    id: access.id,
    userId: access.userId,
    user: access.user,
    status: access.status,
    amountCents: access.amountCents,
    currency: access.currency,
    notes: access.notes,
    adminId: access.adminId,
    approvedAt: access.approvedAt,
    metadata: access.metadata,
    createdAt: access.createdAt,
    updatedAt: access.updatedAt,
  };
}

function serializeJob(job: Prisma.EcuPatcherJobGetPayload<{ include: typeof jobInclude }>) {
  return {
    id: job.id,
    user: job.user,
    upload: job.upload,
    module: job.module,
    status: job.status,
    originalFileName: job.originalFileName,
    originalByteSize: job.originalByteSize,
    originalSha256: job.originalSha256,
    resultFileName: job.resultFileName,
    resultByteSize: job.resultByteSize,
    resultSha256: job.resultSha256,
    patchesApplied: job.patchesApplied,
    patchesTotal: job.patchesTotal,
    failureCode: job.failureCode,
    failureMessage: job.failureMessage,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

adminEcuPatcherRouter.get(
  '/access',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = await prisma.ecuPatcherAccess.findMany({
      where:
        status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
          ? { status: status as UpdateEcuPatcherAccessInput['status'] }
          : {},
      include: accessInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: parseLimit(req.query.limit),
    });

    sendSuccess(res, rows.map(serializeAccess));
  })
);

adminEcuPatcherRouter.patch(
  '/access/:id',
  validateBody(updateEcuPatcherAccessSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as UpdateEcuPatcherAccessInput;
    const prisma = getPrismaClient();
    const existing = await prisma.ecuPatcherAccess.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });

    if (!existing) {
      throw notFound('ECU patcher access request was not found.', { id: req.params.id });
    }

    const access = await prisma.ecuPatcherAccess.update({
      where: { id: req.params.id },
      data: {
        status: input.status,
        notes: input.notes === undefined ? undefined : input.notes,
        adminId: req.auth?.userId,
        approvedAt: input.status === 'APPROVED' ? new Date() : null,
        metadata: toPrismaJson({ updatedBy: req.auth?.email }),
      },
      include: accessInclude,
    });

    await writeAuditLog(req, {
      action: 'admin.ecu_patcher.access.updated',
      entityType: 'EcuPatcherAccess',
      entityId: access.id,
      metadata: {
        userId: access.userId,
        status: access.status,
      },
    });

    sendSuccess(res, serializeAccess(access));
  })
);

adminEcuPatcherRouter.get(
  '/jobs',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const jobs = await prisma.ecuPatcherJob.findMany({
      include: jobInclude,
      orderBy: { createdAt: 'desc' },
      take: parseLimit(req.query.limit),
    });

    sendSuccess(res, jobs.map(serializeJob));
  })
);
