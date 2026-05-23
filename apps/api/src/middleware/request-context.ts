import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const headerRequestId = req.get('x-request-id')?.trim();
  const requestId = headerRequestId && headerRequestId.length <= 128 ? headerRequestId : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  next();
}
