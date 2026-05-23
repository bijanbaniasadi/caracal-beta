import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { healthRouter } from './routes/health.js';

function parseCorsOrigins(value = process.env.CORS_ORIGINS): string[] {
  return (value ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: parseCorsOrigins(), credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    res.json({
      service: 'caracal-api',
      status: 'ok',
    });
  });

  app.use('/health', healthRouter);

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'not_found',
        message: 'Route not found',
      },
    });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected server error';

    res.status(500).json({
      error: {
        code: 'internal_server_error',
        message,
      },
    });
  });

  return app;
}
