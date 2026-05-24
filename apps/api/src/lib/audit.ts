import type { AuditActorType } from '@prisma/client';
import { getPrismaClient } from '@caracal/db';
import type { Request } from 'express';

import { logger } from './logger.js';
import { toPrismaJson } from './prisma-json.js';
import { getRequestMetadata } from './request-metadata.js';

interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string;
  actorType?: AuditActorType;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(req: Request, input: AuditInput): Promise<void> {
  const prisma = getPrismaClient();
  const requestMetadata = getRequestMetadata(req);

  try {
    await prisma.auditLog.create({
      data: {
        actorType: input.actorType ?? (req.auth ? 'USER' : 'ANONYMOUS'),
        actorId: input.actorId ?? req.auth?.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        requestId: requestMetadata.requestId,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: toPrismaJson(input.metadata),
      },
    });
  } catch (error) {
    logger.error(
      { err: error, action: input.action, entityType: input.entityType },
      'audit log write failed'
    );
  }
}
