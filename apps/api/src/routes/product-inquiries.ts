import { getPrismaClient } from '@caracal/db';
import { Router, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { createReferenceCode } from '../lib/reference-code.js';
import { intakeLimiter } from '../middleware/rate-limit.js';
import { validateBody } from '../middleware/validate.js';
import { productInquirySchema, type ProductInquiryInput } from '../schemas/intake.js';

export const productInquiriesRouter: ExpressRouter = Router();

productInquiriesRouter.post(
  '/',
  intakeLimiter,
  validateBody(productInquirySchema),
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const input = req.body as ProductInquiryInput;

    const productInquiry = await prisma.productInquiry.create({
      data: {
        referenceCode: createReferenceCode('PI'),
        productId: input.productId,
        productSku: input.productSku,
        productName: input.productName,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        companyName: input.companyName,
        quantity: input.quantity,
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
      action: 'product_inquiry.created',
      entityType: 'ProductInquiry',
      entityId: productInquiry.id,
      metadata: {
        referenceCode: productInquiry.referenceCode,
        productSku: input.productSku,
        customerEmail: input.customerEmail,
        source: input.source,
      },
    });

    sendSuccess(res, productInquiry, 201);
  })
);
