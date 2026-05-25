import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { getPrismaClient } from '@caracal/db';
import type { EcuPatcherAccessStatus, Prisma, StorageProvider } from '@prisma/client';
import { Router, type Request, type Router as ExpressRouter } from 'express';
import multer from 'multer';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { executeLegacyPatch, moduleConfigs } from '../lib/ecu-patcher/engine.js';
import { badRequest, forbidden, notFound, unauthorized } from '../lib/errors.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { readObject, storeObject } from '../lib/storage.js';
import { authenticateAccessToken, requireRoles } from '../middleware/auth.js';
import {
  createEcuPatcherJobSchema,
  requestEcuPatcherAccessSchema,
  type CreateEcuPatcherJobInput,
  type RequestEcuPatcherAccessInput,
} from '../schemas/ecu-patcher.js';

export const ecuPatcherRouter: ExpressRouter = Router();

const maxPatcherUploadBytes = Number.parseInt(
  process.env.ECU_PATCHER_MAX_UPLOAD_BYTES ?? process.env.BIN_UPLOAD_MAX_SIZE ?? '52428800',
  10
);
const acceptedExtensions = new Set(['.bin', '.ori', '.hex']);

const patcherUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxPatcherUploadBytes,
    files: 1,
    fields: 8,
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!acceptedExtensions.has(extension)) {
      cb(badRequest('Only .bin, .ori, and .hex ECU files are accepted.'));
      return;
    }

    cb(null, true);
  },
});

const patcherJobInclude = {
  upload: {
    select: {
      id: true,
      originalFileName: true,
      status: true,
      createdAt: true,
    },
  },
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true,
      workshopName: true,
    },
  },
} satisfies Prisma.EcuPatcherJobInclude;

function getCurrentUser(req: Request) {
  if (!req.auth) {
    throw unauthorized('Authentication required.');
  }

  return req.auth;
}

function sanitizeFileName(fileName: string): string {
  return path
    .basename(fileName)
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+/, '')
    .slice(0, 180);
}

function createObjectKey(kind: 'original' | 'result', extension = '.bin'): string {
  const date = new Date().toISOString().slice(0, 10);
  return `ecu-patcher/${date}/${kind}/${randomUUID()}${extension}`;
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseLimit(value: unknown, fallback = 20): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(raw ?? fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 100);
}

function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'staff';
}

async function requirePatcherAccess(req: Request): Promise<EcuPatcherAccessStatus | 'APPROVED'> {
  const user = getCurrentUser(req);

  if (isAdminRole(user.role)) {
    return 'APPROVED';
  }

  const prisma = getPrismaClient();
  const access = await prisma.ecuPatcherAccess.findUnique({
    where: { userId: user.userId },
    select: { status: true },
  });

  if (access?.status !== 'APPROVED') {
    throw forbidden('ECU patcher access is not approved for this account.', {
      status: access?.status ?? null,
    });
  }

  return access.status;
}

function serializeAccess(
  access: Prisma.EcuPatcherAccessGetPayload<{ include: { user: true } }> | null,
  role: string
) {
  const admin = isAdminRole(role);

  return {
    hasAccess: admin || access?.status === 'APPROVED',
    status: admin ? 'APPROVED' : (access?.status ?? null),
    amountCents: access?.amountCents ?? 120_000,
    currency: access?.currency ?? 'AED',
    notes: access?.notes ?? null,
    approvedAt: access?.approvedAt ?? null,
    requestedAt: access?.createdAt ?? null,
  };
}

function serializeJob(job: Prisma.EcuPatcherJobGetPayload<{ include: typeof patcherJobInclude }>) {
  return {
    id: job.id,
    module: job.module,
    status: job.status,
    originalFileName: job.originalFileName,
    originalByteSize: job.originalByteSize,
    originalSha256: job.originalSha256,
    resultFileName: job.resultFileName,
    resultByteSize: job.resultByteSize,
    resultSha256: job.resultSha256,
    patches: {
      total: job.patchesTotal,
      ready: job.patchesReady,
      applied: job.patchesApplied,
      alreadyApplied: job.patchesAlreadyApplied,
      mismatched: job.patchesMismatched,
    },
    checksum: {
      applied: job.checksumApplied,
      offset: job.checksumOffset,
      value: job.checksumValue,
    },
    failure: job.failureCode
      ? {
          code: job.failureCode,
          message: job.failureMessage,
        }
      : null,
    logs: job.logs,
    metadata: job.metadata,
    downloadUrl:
      job.status === 'COMPLETED' && job.resultObjectKey
        ? `/api/ecu-patcher/jobs/${job.id}/download`
        : null,
    upload: job.upload,
    user: job.user,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

async function findVisibleJob(req: Request, id: string) {
  const user = getCurrentUser(req);
  const prisma = getPrismaClient();
  const job = await prisma.ecuPatcherJob.findFirst({
    where: {
      id,
      ...(isAdminRole(user.role) ? {} : { userId: user.userId }),
    },
    include: patcherJobInclude,
  });

  if (!job) {
    throw notFound('ECU patcher job was not found.', { id });
  }

  return job;
}

ecuPatcherRouter.use(authenticateAccessToken, requireRoles('customer', 'admin', 'staff'));

ecuPatcherRouter.get(
  '/modules',
  asyncHandler(async (_req, res) => {
    sendSuccess(
      res,
      Object.values(moduleConfigs).map((config) => ({
        module: config.module,
        label: config.label,
        expectedFileSize: config.expectedFileSize ?? null,
        suffix: config.suffix,
        checksumSupported: Boolean(config.checksum),
      }))
    );
  })
);

ecuPatcherRouter.get(
  '/access',
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const prisma = getPrismaClient();
    const access = await prisma.ecuPatcherAccess.findUnique({
      where: { userId: user.userId },
      include: { user: true },
    });

    sendSuccess(res, serializeAccess(access, user.role));
  })
);

ecuPatcherRouter.post(
  '/access-requests',
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    if (user.role !== 'customer') {
      throw forbidden('Only customer accounts can request ECU patcher access.');
    }

    const parsed = requestEcuPatcherAccessSchema.parse(req.body);
    const input = parsed as RequestEcuPatcherAccessInput;
    const prisma = getPrismaClient();
    const access = await prisma.ecuPatcherAccess.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        notes: input.notes,
        status: 'PENDING',
        metadata: toPrismaJson({ source: 'web_ecu_patcher' }),
      },
      update: {
        notes: input.notes,
      },
      include: { user: true },
    });

    await writeAuditLog(req, {
      actorType: 'USER',
      actorId: user.userId,
      action: 'ecu_patcher.access.requested',
      entityType: 'EcuPatcherAccess',
      entityId: access.id,
      metadata: {
        status: access.status,
        amountCents: access.amountCents,
      },
    });

    sendSuccess(res, serializeAccess(access, user.role), 201);
  })
);

ecuPatcherRouter.get(
  '/jobs',
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const limit = parseLimit(req.query.limit);
    const prisma = getPrismaClient();
    const jobs = await prisma.ecuPatcherJob.findMany({
      where: isAdminRole(user.role) ? {} : { userId: user.userId },
      include: patcherJobInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    sendSuccess(res, jobs.map(serializeJob));
  })
);

ecuPatcherRouter.get(
  '/jobs/:id',
  asyncHandler(async (req, res) => {
    const job = await findVisibleJob(req, req.params.id);
    sendSuccess(res, serializeJob(job));
  })
);

ecuPatcherRouter.post(
  '/jobs',
  patcherUploadMiddleware.single('file'),
  asyncHandler(async (req, res) => {
    await requirePatcherAccess(req);

    const user = getCurrentUser(req);
    const parsed = createEcuPatcherJobSchema.parse(req.body);
    const input = parsed as CreateEcuPatcherJobInput;
    const file = req.file;

    if (!file) {
      throw badRequest('An ECU binary file is required in the "file" form field.');
    }

    if (file.size <= 0) {
      throw badRequest('Uploaded ECU file cannot be empty.');
    }

    const prisma = getPrismaClient();
    const originalFileName = sanitizeFileName(file.originalname);
    const originalSha256 = sha256(file.buffer);
    const extension = path.extname(originalFileName).toLowerCase() || '.bin';
    const originalStored = await storeObject({
      key: createObjectKey('original', acceptedExtensions.has(extension) ? extension : '.bin'),
      body: file.buffer,
      contentType: 'application/octet-stream',
    });

    const upload = await prisma.binUpload.create({
      data: {
        originalFileName,
        storedObjectKey: originalStored.key,
        storageProvider: originalStored.provider,
        mimeType: file.mimetype || 'application/octet-stream',
        byteSize: file.size,
        sha256: originalSha256,
        status: 'STORED',
        requesterName: user.name,
        requesterEmail: user.email,
        productContext: `ECU Patcher: ${input.module}`,
        notes: 'Legacy ECU patcher workflow upload.',
        metadata: toPrismaJson({
          source: 'ecu_patcher',
          module: input.module,
        }),
      },
      select: {
        id: true,
      },
    });

    const createdJob = await prisma.ecuPatcherJob.create({
      data: {
        userId: user.userId,
        uploadId: upload.id,
        module: input.module,
        status: 'RUNNING',
        originalFileName,
        originalByteSize: file.size,
        originalSha256,
        metadata: toPrismaJson({
          source: 'legacy_ecu_patcher',
          originalObjectKey: originalStored.key,
          originalStorageProvider: originalStored.provider,
        }),
      },
      select: { id: true },
    });

    const result = executeLegacyPatch({
      module: input.module,
      fileName: originalFileName,
      bytes: file.buffer,
      fixChecksum: input.fixChecksum,
    });

    let resultObjectKey: string | undefined;
    let resultStorageProvider: StorageProvider | undefined;

    if (result.status === 'COMPLETED' && result.outputBytes && result.outputFileName) {
      const stored = await storeObject({
        key: createObjectKey('result', '.bin'),
        body: result.outputBytes,
        contentType: 'application/octet-stream',
      });
      resultObjectKey = stored.key;
      resultStorageProvider = stored.provider as StorageProvider;
    }

    const job = await prisma.ecuPatcherJob.update({
      where: { id: createdJob.id },
      data: {
        status: result.status,
        resultFileName: result.outputFileName,
        resultObjectKey,
        resultStorageProvider,
        resultByteSize: result.resultByteSize,
        resultSha256: result.resultSha256,
        patchesTotal: result.patchesTotal,
        patchesReady: result.patchesReady,
        patchesApplied: result.patchesApplied,
        patchesAlreadyApplied: result.patchesAlreadyApplied,
        patchesMismatched: result.patchesMismatched,
        checksumApplied: result.checksumApplied,
        checksumOffset: result.checksumOffset,
        checksumValue: result.checksumValue,
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
        logs: toPrismaJson(result.logs),
        metadata: toPrismaJson({
          ...result.metadata,
          source: 'legacy_ecu_patcher',
          originalObjectKey: originalStored.key,
          originalStorageProvider: originalStored.provider,
          resultObjectKey,
          resultStorageProvider,
        }),
        completedAt: result.status === 'COMPLETED' ? new Date() : undefined,
        failedAt:
          result.status === 'FAILED' || result.status === 'REJECTED' ? new Date() : undefined,
      },
      include: patcherJobInclude,
    });

    await writeAuditLog(req, {
      actorType: 'USER',
      actorId: user.userId,
      action: 'ecu_patcher.job.processed',
      entityType: 'EcuPatcherJob',
      entityId: job.id,
      metadata: {
        module: job.module,
        status: job.status,
        uploadId: upload.id,
        patchesApplied: job.patchesApplied,
        resultSha256: job.resultSha256,
      },
    });

    sendSuccess(res, serializeJob(job), 201);
  })
);

ecuPatcherRouter.get(
  '/jobs/:id/download',
  asyncHandler(async (req, res) => {
    const job = await findVisibleJob(req, req.params.id);

    if (!job.resultObjectKey || !job.resultStorageProvider || !job.resultFileName) {
      throw notFound('No patched result is available for this job.', { id: job.id });
    }

    const object = await readObject({
      key: job.resultObjectKey,
      provider: job.resultStorageProvider,
    });

    await writeAuditLog(req, {
      action: 'ecu_patcher.result.downloaded',
      entityType: 'EcuPatcherJob',
      entityId: job.id,
      metadata: {
        module: job.module,
        resultSha256: job.resultSha256,
      },
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(object.body.length));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${job.resultFileName.replace(/"/g, '')}"`
    );
    res.send(object.body);
  })
);
