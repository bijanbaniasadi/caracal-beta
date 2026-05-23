import { getPrismaClient } from '@caracal/db';
import { Router, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { createReferenceCode } from '../lib/reference-code.js';
import { intakeLimiter } from '../middleware/rate-limit.js';
import { validateBody } from '../middleware/validate.js';
import {
  workshopConsultationLeadSchema,
  type WorkshopConsultationLeadInput,
} from '../schemas/intake.js';

export const workshopConsultationsRouter: ExpressRouter = Router();

workshopConsultationsRouter.post(
  '/',
  intakeLimiter,
  validateBody(workshopConsultationLeadSchema),
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const input = req.body as WorkshopConsultationLeadInput;

    const lead = await prisma.workshopConsultationLead.create({
      data: {
        referenceCode: createReferenceCode('WC'),
        workshopName: input.workshopName,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        location: input.location,
        monthlyVolume: input.monthlyVolume,
        serviceInterests: toPrismaJson(input.serviceInterests),
        preferredTimeline: input.preferredTimeline,
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
      action: 'workshop_consultation_lead.created',
      entityType: 'WorkshopConsultationLead',
      entityId: lead.id,
      metadata: {
        referenceCode: lead.referenceCode,
        contactEmail: input.contactEmail,
        source: input.source,
      },
    });

    sendSuccess(res, lead, 201);
  })
);
