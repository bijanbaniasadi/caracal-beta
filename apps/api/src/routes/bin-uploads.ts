import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { getPrismaClient } from '@caracal/db';
import { Router, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { badRequest } from '../lib/errors.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { storeObject } from '../lib/storage.js';
import { uploadLimiter } from '../middleware/rate-limit.js';
import { binUploadMiddleware, getMaxUploadBytes } from '../middleware/upload.js';
import { binUploadFieldsSchema, type BinUploadFieldsInput } from '../schemas/intake.js';

export const binUploadsRouter: ExpressRouter = Router();

function sanitizeFileName(fileName: string): string {
  return path
    .basename(fileName)
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+/, '')
    .slice(0, 180);
}

function createObjectKey(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `bin-uploads/${date}/${randomUUID()}.bin`;
}

binUploadsRouter.post(
  '/',
  uploadLimiter,
  binUploadMiddleware.single('file'),
  asyncHandler(async (req, res) => {
    const parsedFields = binUploadFieldsSchema.safeParse(req.body);

    if (!parsedFields.success) {
      throw badRequest('Upload metadata validation failed.', parsedFields.error.flatten());
    }

    const file = req.file;

    if (!file) {
      throw badRequest('A .bin file is required in the "file" form field.');
    }

    if (file.size <= 0) {
      throw badRequest('Uploaded BIN file cannot be empty.');
    }

    if (file.size > getMaxUploadBytes()) {
      throw badRequest('Uploaded BIN file exceeds the configured size limit.');
    }

    const input = parsedFields.data as BinUploadFieldsInput;
    const prisma = getPrismaClient();
    const objectKey = createObjectKey();
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    if (input.quoteRequestId) {
      const quoteRequestExists = await prisma.quoteRequest.findUnique({
        where: { id: input.quoteRequestId },
        select: { id: true },
      });

      if (!quoteRequestExists) {
        throw badRequest('quoteRequestId does not match an existing quote request.');
      }
    }

    const stored = await storeObject({
      key: objectKey,
      body: file.buffer,
      contentType: 'application/octet-stream',
    });

    const upload = await prisma.binUpload.create({
      data: {
        originalFileName: sanitizeFileName(file.originalname),
        storedObjectKey: stored.key,
        storageProvider: stored.provider,
        mimeType: file.mimetype || 'application/octet-stream',
        byteSize: file.size,
        sha256,
        status: 'STORED',
        requesterName: input.requesterName,
        requesterEmail: input.requesterEmail,
        productContext: input.productContext,
        notes: input.notes,
        quoteRequestId: input.quoteRequestId,
        metadata: toPrismaJson({
          fieldName: file.fieldname,
          encoding: file.encoding,
        }),
      },
      select: {
        id: true,
        originalFileName: true,
        storedObjectKey: true,
        storageProvider: true,
        byteSize: true,
        sha256: true,
        status: true,
        createdAt: true,
      },
    });

    await writeAuditLog(req, {
      action: 'bin_upload.created',
      entityType: 'BinUpload',
      entityId: upload.id,
      metadata: {
        originalFileName: upload.originalFileName,
        byteSize: upload.byteSize,
        sha256: upload.sha256,
        storageProvider: upload.storageProvider,
        quoteRequestId: input.quoteRequestId,
      },
    });

    sendSuccess(res, upload, 201);
  })
);
