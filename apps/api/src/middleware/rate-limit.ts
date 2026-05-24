import rateLimit from 'express-rate-limit';

import { tooManyRequests } from '../lib/errors.js';

const fifteenMinutes = 15 * 60 * 1000;

export const apiLimiter = rateLimit({
  windowMs: fifteenMinutes,
  limit: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(tooManyRequests('Too many requests. Please try again later.'));
  },
});

export const authLimiter = rateLimit({
  windowMs: fifteenMinutes,
  limit: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '20', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(tooManyRequests('Too many authentication attempts. Please try again later.'));
  },
});

export const intakeLimiter = rateLimit({
  windowMs: fifteenMinutes,
  limit: Number.parseInt(process.env.INTAKE_RATE_LIMIT_MAX ?? '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(tooManyRequests('Too many intake submissions. Please try again later.'));
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number.parseInt(process.env.UPLOAD_RATE_LIMIT_MAX ?? '12', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(tooManyRequests('Too many upload attempts. Please try again later.'));
  },
});
