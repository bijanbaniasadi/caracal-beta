import type { Response } from 'express';

interface ApiMeta {
  requestId?: string;
  [key: string]: unknown;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

function getRequestId(res: Response): string | undefined {
  return typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta: ApiMeta = {}
): Response {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      requestId: getRequestId(res),
      ...meta,
    },
  });
}

export function sendError(res: Response, error: ApiErrorPayload, statusCode: number): Response {
  return res.status(statusCode).json({
    success: false,
    error,
    meta: {
      requestId: getRequestId(res),
    },
  });
}
