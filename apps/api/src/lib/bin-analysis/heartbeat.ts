import os from 'node:os';
import { getPrismaClient } from '@caracal/db';

import { logger } from '../logger.js';
import { withDbRetry } from '../observability/db-retry.js';
import { toPrismaJson } from '../prisma-json.js';

export interface WorkerHeartbeatConfig {
  workerId: string;
  workerType: string;
  queueName: string;
  concurrency: number;
  metadata?: Record<string, unknown>;
}

export function createWorkerId(workerType: string, queueName: string): string {
  return [workerType, queueName, os.hostname(), process.pid, Date.now()]
    .join('-')
    .replace(/[^a-zA-Z0-9_.-]+/g, '-');
}

export function getHeartbeatIntervalMs(): number {
  return Number.parseInt(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? '15000', 10);
}

export async function markWorkerHeartbeat(
  config: WorkerHeartbeatConfig,
  status: 'ONLINE' | 'STOPPING' | 'OFFLINE' | 'ERROR',
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const prisma = getPrismaClient();
  const now = new Date();

  await withDbRetry('worker_heartbeat_upsert', () =>
    prisma.workerHeartbeat.upsert({
      where: { workerId: config.workerId },
      update: {
        status,
        processId: process.pid,
        hostname: os.hostname(),
        concurrency: config.concurrency,
        lastSeenAt: now,
        stoppedAt: status === 'OFFLINE' ? now : undefined,
        metadata: toPrismaJson({
          ...config.metadata,
          ...metadata,
        }),
      },
      create: {
        workerId: config.workerId,
        workerType: config.workerType,
        queueName: config.queueName,
        status,
        processId: process.pid,
        hostname: os.hostname(),
        concurrency: config.concurrency,
        startedAt: now,
        lastSeenAt: now,
        stoppedAt: status === 'OFFLINE' ? now : undefined,
        metadata: toPrismaJson({
          ...config.metadata,
          ...metadata,
        }),
      },
    })
  );
}

export function startWorkerHeartbeat(config: WorkerHeartbeatConfig): () => Promise<void> {
  let stopped = false;
  let heartbeatInFlight = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (stopped || heartbeatInFlight) {
      return;
    }

    heartbeatInFlight = true;

    try {
      await markWorkerHeartbeat(config, 'ONLINE', {
        memoryUsage: process.memoryUsage(),
      });
    } catch (error) {
      logger.error({ err: error, workerId: config.workerId }, 'worker heartbeat failed');
    } finally {
      heartbeatInFlight = false;
    }
  };

  void tick();
  timer = setInterval(() => void tick(), getHeartbeatIntervalMs());
  timer.unref();

  return async () => {
    stopped = true;

    if (timer) {
      clearInterval(timer);
    }

    await markWorkerHeartbeat(config, 'OFFLINE');
  };
}
