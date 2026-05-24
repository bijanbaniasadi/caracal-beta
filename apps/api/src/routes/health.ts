import { Router, type Router as ExpressRouter } from 'express';
import { getPrismaClient } from '@caracal/db';

import { getEcuCorpusQueueStats } from '../lib/ecu-corpus/queues.js';
import { logger } from '../lib/logger.js';

export const healthRouter: ExpressRouter = Router();

function baseHealth() {
  return {
    status: 'ok',
    service: 'caracal-api',
    version: process.env.npm_package_version ?? '0.1.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    memoryUsage: process.memoryUsage(),
  };
}

async function databaseProbe() {
  const started = Date.now();
  const prisma = getPrismaClient();

  await prisma.$queryRaw`SELECT 1`;

  return {
    ok: true,
    latencyMs: Date.now() - started,
  };
}

async function redisProbe() {
  const started = Date.now();
  const queues = await getEcuCorpusQueueStats();

  return {
    ok: true,
    latencyMs: Date.now() - started,
    queues,
  };
}

healthRouter.get('/', (_req, res) => {
  res.json(baseHealth());
});

healthRouter.get('/live', (_req, res) => {
  res.json(baseHealth());
});

healthRouter.get('/ready', async (_req, res) => {
  const [database, redis] = await Promise.allSettled([databaseProbe(), redisProbe()]);
  const ready = database.status === 'fulfilled' && redis.status === 'fulfilled';

  if (!ready) {
    logger.warn({ database, redis }, 'readiness probe failed');
  }

  res.status(ready ? 200 : 503).json({
    ...baseHealth(),
    status: ready ? 'ok' : 'degraded',
    checks: {
      database:
        database.status === 'fulfilled'
          ? database.value
          : {
              ok: false,
              error: database.reason instanceof Error ? database.reason.message : 'failed',
            },
      redis:
        redis.status === 'fulfilled'
          ? redis.value
          : { ok: false, error: redis.reason instanceof Error ? redis.reason.message : 'failed' },
    },
  });
});

healthRouter.get('/runtime', async (_req, res) => {
  const queues = await getEcuCorpusQueueStats();

  res.json({
    ...baseHealth(),
    queues,
    diagnostics: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      resourceUsage: process.resourceUsage(),
    },
  });
});
