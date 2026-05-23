import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { sendError } from '../lib/api-response.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function notFoundHandler(req: Request, res: Response): void {
  sendError(
    res,
    {
      code: 'not_found',
      message: `Route not found: ${req.method} ${req.path}`,
    },
    404
  );
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (res.headersSent) {
    logger.error({ err: error, requestId: res.locals.requestId }, 'error after headers sent');
    return;
  }

  if (error instanceof AppError) {
    sendError(
      res,
      {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      error.statusCode
    );
    return;
  }

  if (error instanceof ZodError) {
    sendError(
      res,
      {
        code: 'validation_error',
        message: 'Request validation failed.',
        details: error.flatten(),
      },
      400
    );
    return;
  }

  if (error instanceof multer.MulterError) {
    sendError(
      res,
      {
        code: 'upload_error',
        message: error.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file exceeds the size limit.' : error.message,
      },
      400
    );
    return;
  }

  logger.error({ err: error, requestId: res.locals.requestId, path: req.path }, 'unhandled request error');

  sendError(
    res,
    {
      code: 'internal_server_error',
      message: 'Unexpected server error.',
    },
    500
  );
}
