import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { sendSuccess } from './lib/api-response.js';
import { httpLogger } from './lib/logger.js';
import { prometheusContentType, prometheusMetricsText } from './lib/observability/metrics.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { requestContext } from './middleware/request-context.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { binUploadsRouter } from './routes/bin-uploads.js';
import { categoriesRouter } from './routes/categories.js';
import { checkoutRouter, checkoutWebhookRouter } from './routes/checkout.js';
import { healthRouter } from './routes/health.js';
import { productInquiriesRouter } from './routes/product-inquiries.js';
import { productsRouter } from './routes/products.js';
import { quoteRequestsRouter } from './routes/quote-requests.js';
import { workshopConsultationsRouter } from './routes/workshop-consultations.js';

function parseCorsOrigins(value = process.env.CORS_ORIGINS): string[] {
  return (value ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createApp(): express.Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: parseCorsOrigins(), credentials: true }));
  app.use(requestContext);
  app.use(httpLogger);
  app.use(metricsMiddleware);
  app.use('/api/checkout/webhook', express.raw({ type: 'application/json' }), checkoutWebhookRouter);
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    sendSuccess(res, {
      service: 'caracal-api',
      status: 'ok',
    });
  });

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', prometheusContentType());
    res.send(await prometheusMetricsText());
  });

  app.use('/health', healthRouter);
  app.use('/api', apiLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/bin-uploads', binUploadsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/checkout', checkoutRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/quote-requests', quoteRequestsRouter);
  app.use('/api/product-inquiries', productInquiriesRouter);
  app.use('/api/workshop-consultations', workshopConsultationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
