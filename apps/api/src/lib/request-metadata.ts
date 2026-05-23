import type { Request } from 'express';

export interface RequestMetadata {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export function getRequestMetadata(req: Request): RequestMetadata {
  const requestId = typeof req.res?.locals.requestId === 'string' ? req.res.locals.requestId : undefined;

  return {
    requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}
