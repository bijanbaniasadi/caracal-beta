import type { RequestHandler } from 'express';

import { httpRequestDuration } from '../lib/observability/metrics.js';

export const metricsMiddleware: RequestHandler = (req, res, next) => {
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedSeconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
    const route = req.route?.path ?? req.path;

    httpRequestDuration.observe(
      {
        method: req.method,
        route: typeof route === 'string' ? route : 'unknown',
        status_code: String(res.statusCode),
      },
      elapsedSeconds
    );
  });

  next();
};
