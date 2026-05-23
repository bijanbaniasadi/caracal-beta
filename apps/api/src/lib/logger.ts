import pino from 'pino';
import { pinoHttp } from 'pino-http';
import type { Request, RequestHandler, Response } from 'express';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'caracal-api',
    environment: process.env.NODE_ENV ?? 'development',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.token',
      'body.secret',
      'metadata.authorization',
    ],
    remove: true,
  },
});

export const httpLogger: RequestHandler = pinoHttp<Request, Response>({
  logger,
  customProps: (_req, res) => ({
    requestId: res.locals.requestId,
  }),
}) as RequestHandler;
