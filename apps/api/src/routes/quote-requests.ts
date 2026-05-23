import { getPrismaClient } from '@caracal/db';
import { Router, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { createReferenceCode } from '../lib/reference-code.js';
import { intakeLimiter } from '../middleware/rate-limit.js';
import { validateBody } from '../middleware/validate.js';
import { quoteRequestSchema, type QuoteRequestInput } from '../schemas/intake.js';

export const quoteRequestsRouter: ExpressRouter = Router();

quoteRequestsRouter.post(
  '/',
  intakeLimiter,
  validateBody(quoteRequestSchema),
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const input = req.body as QuoteRequestInput;

    const quoteRequest = await prisma.quoteRequest.create({
      data: {
        referenceCode: createReferenceCode('QR'),
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        companyName: input.companyName,
        workshopName: input.workshopName,
        vehicleDetails: input.vehicleDetails,
        requestedItems: toPrismaJson(input.requestedItems),
        message: input.message,
        source: input.source,
        metadata: toPrismaJson(input.metadata),
      },
      select: {
        id: true,
        referenceCode: true,
        status: true,
        createdAt: true,
      },
    });

    await writeAuditLog(req, {
      action: 'quote_request.created',
      entityType: 'QuoteRequest',
      entityId: quoteRequest.id,
      metadata: {
        referenceCode: quoteRequest.referenceCode,
        customerEmail: input.customerEmail,
        source: input.source,
      },
    });

    sendSuccess(res, quoteRequest, 201);
  })
);
