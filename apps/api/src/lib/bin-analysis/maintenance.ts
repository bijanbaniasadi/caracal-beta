import type { Queue } from 'bullmq';
import { getPrismaClient } from '@caracal/db';

import { logger } from '../logger.js';
import {
  binAnalysisQueueName,
  createBinAnalysisQueue,
  retryBinAnalysisJob,
  type BinAnalysisJobData,
} from './queue.js';

export interface QueueCleanupResult {
  failed: number;
  completed: number;
}

export interface StalledRecoveryResult {
  scanned: number;
  requeued: number;
}

export function getQueueCleanupIntervalMs(): number {
  return Number.parseInt(process.env.BIN_ANALYSIS_CLEANUP_INTERVAL_MS ?? '900000', 10);
}

export function getFailedJobRetentionMs(): number {
  return Number.parseInt(
    process.env.BIN_ANALYSIS_FAILED_JOB_RETENTION_MS ?? String(7 * 24 * 60 * 60 * 1000),
    10
  );
}

export function getCompletedJobRetentionMs(): number {
  return Number.parseInt(
    process.env.BIN_ANALYSIS_COMPLETED_JOB_RETENTION_MS ?? String(24 * 60 * 60 * 1000),
    10
  );
}

export function getQueueCleanupLimit(): number {
  return Number.parseInt(process.env.BIN_ANALYSIS_CLEANUP_LIMIT ?? '1000', 10);
}

export function getStalledRecoveryAfterMs(): number {
  return Number.parseInt(process.env.BIN_ANALYSIS_STALLED_AFTER_MS ?? '300000', 10);
}

export async function cleanBinAnalysisQueue(
  queue?: Queue<BinAnalysisJobData>
): Promise<QueueCleanupResult> {
  const activeQueue = queue ?? createBinAnalysisQueue();
  const limit = getQueueCleanupLimit();

  try {
    const [failed, completed] = await Promise.all([
      activeQueue.clean(getFailedJobRetentionMs(), limit, 'failed'),
      activeQueue.clean(getCompletedJobRetentionMs(), limit, 'completed'),
    ]);

    return {
      failed: failed.length,
      completed: completed.length,
    };
  } finally {
    if (!queue) {
      await activeQueue.close();
    }
  }
}

export async function recoverStalledAnalysisJobs(): Promise<StalledRecoveryResult> {
  const prisma = getPrismaClient();
  const cutoff = new Date(Date.now() - getStalledRecoveryAfterMs());
  const stalledJobs = await prisma.binAnalysisJob.findMany({
    where: {
      status: 'RUNNING',
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      uploadId: true,
      priority: true,
    },
    take: Number.parseInt(process.env.BIN_ANALYSIS_STALLED_RECOVERY_LIMIT ?? '25', 10),
  });

  let requeued = 0;

  for (const job of stalledJobs) {
    try {
      await retryBinAnalysisJob(job.id, job.priority);
      requeued += 1;
    } catch (error) {
      logger.error(
        { err: error, analysisJobId: job.id, uploadId: job.uploadId },
        'stalled BIN analysis job recovery failed'
      );
    }
  }

  return {
    scanned: stalledJobs.length,
    requeued,
  };
}

export function startQueueMaintenanceCron(queue: Queue<BinAnalysisJobData>): () => void {
  let running = false;
  const intervalMs = getQueueCleanupIntervalMs();

  const tick = async () => {
    if (running) {
      return;
    }

    running = true;

    try {
      const [cleanup, recovery] = await Promise.all([
        cleanBinAnalysisQueue(queue),
        recoverStalledAnalysisJobs(),
      ]);

      logger.info(
        {
          queueName: binAnalysisQueueName,
          cleanup,
          recovery,
        },
        'BIN analysis queue maintenance completed'
      );
    } catch (error) {
      logger.error(
        { err: error, queueName: binAnalysisQueueName },
        'BIN analysis queue maintenance failed'
      );
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
