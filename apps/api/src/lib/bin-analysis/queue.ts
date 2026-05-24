import { Queue, type JobsOptions } from 'bullmq';
import { getPrismaClient } from '@caracal/db';
import type { Request } from 'express';

import { writeAuditLog } from '../audit.js';
import { logger } from '../logger.js';
import { toPrismaJson } from '../prisma-json.js';

export const binAnalysisQueueName = process.env.BIN_ANALYSIS_QUEUE_NAME ?? 'bin-analysis';
export const binAnalysisJobName = 'analyze-bin-upload';
let sharedBinAnalysisQueue: Queue<BinAnalysisJobData> | null = null;

export interface BinAnalysisJobData {
  analysisJobId: string;
  uploadId: string;
}

export interface EnqueueBinAnalysisInput {
  uploadId: string;
  priority?: number;
  force?: boolean;
  metadata?: Record<string, unknown>;
}

export function getRedisConnectionOptions() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: Number.parseInt(url.port || '6379', 10),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname ? Number.parseInt(url.pathname.slice(1) || '0', 10) : 0,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
    connectTimeout: Number.parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS ?? '10000', 10),
    keepAlive: Number.parseInt(process.env.REDIS_KEEP_ALIVE_MS ?? '30000', 10),
    retryStrategy: (attempt: number) =>
      Math.min(
        attempt * Number.parseInt(process.env.REDIS_RECONNECT_BASE_DELAY_MS ?? '500', 10),
        Number.parseInt(process.env.REDIS_RECONNECT_MAX_DELAY_MS ?? '10000', 10)
      ),
  };
}

export function getBinAnalysisAttempts(): number {
  return Number.parseInt(process.env.BIN_ANALYSIS_MAX_ATTEMPTS ?? '3', 10);
}

export function getBinAnalysisBackoffMs(): number {
  return Number.parseInt(process.env.BIN_ANALYSIS_RETRY_BACKOFF_MS ?? '30000', 10);
}

export function getBinAnalysisRemoveOnComplete(): number {
  return Number.parseInt(process.env.BIN_ANALYSIS_REMOVE_ON_COMPLETE_COUNT ?? '1000', 10);
}

export function getBinAnalysisRemoveOnFail(): number {
  return Number.parseInt(process.env.BIN_ANALYSIS_REMOVE_ON_FAIL_COUNT ?? '5000', 10);
}

export function createBinAnalysisQueue(): Queue<BinAnalysisJobData> {
  return new Queue<BinAnalysisJobData>(binAnalysisQueueName, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: {
      attempts: getBinAnalysisAttempts(),
      backoff: {
        type: 'exponential',
        delay: getBinAnalysisBackoffMs(),
      },
      removeOnComplete: getBinAnalysisRemoveOnComplete(),
      removeOnFail: getBinAnalysisRemoveOnFail(),
    },
  });
}

export function getBinAnalysisQueue(): Queue<BinAnalysisJobData> {
  sharedBinAnalysisQueue ??= createBinAnalysisQueue();
  return sharedBinAnalysisQueue;
}

export async function closeBinAnalysisQueue(): Promise<void> {
  if (sharedBinAnalysisQueue) {
    await sharedBinAnalysisQueue.close();
    sharedBinAnalysisQueue = null;
  }
}

function queueJobOptions(input: EnqueueBinAnalysisInput): JobsOptions {
  return {
    jobId: `${input.uploadId}-${Date.now()}`,
    priority: input.priority ?? 0,
    attempts: getBinAnalysisAttempts(),
    backoff: {
      type: 'exponential',
      delay: getBinAnalysisBackoffMs(),
    },
  };
}

export async function enqueueBinAnalysisJob(input: EnqueueBinAnalysisInput) {
  const prisma = getPrismaClient();
  const upload = await prisma.binUpload.findUnique({
    where: { id: input.uploadId },
    select: { id: true },
  });

  if (!upload) {
    throw new Error(`BinUpload not found: ${input.uploadId}`);
  }

  if (!input.force) {
    const existing = await prisma.binAnalysisJob.findFirst({
      where: {
        uploadId: input.uploadId,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return {
        queued: false,
        job: existing,
      };
    }
  }

  const analysisJob = await prisma.binAnalysisJob.create({
    data: {
      uploadId: input.uploadId,
      queueName: binAnalysisQueueName,
      status: 'QUEUED',
      stage: 'QUEUED',
      priority: input.priority ?? 0,
      maxAttempts: getBinAnalysisAttempts(),
      metadata: toPrismaJson(input.metadata),
    },
  });

  const queue = createBinAnalysisQueue();

  try {
    const bullJob = await queue.add(
      binAnalysisJobName,
      {
        analysisJobId: analysisJob.id,
        uploadId: input.uploadId,
      },
      queueJobOptions(input)
    );

    const updated = await prisma.binAnalysisJob.update({
      where: { id: analysisJob.id },
      data: {
        bullJobId: bullJob.id,
      },
    });

    return {
      queued: true,
      job: updated,
    };
  } catch (error) {
    await prisma.binAnalysisJob.update({
      where: { id: analysisJob.id },
      data: {
        status: 'FAILED',
        stage: 'FAILED',
        progress: 0,
        failedAt: new Date(),
        errorCode: 'QUEUE_ENQUEUE_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Failed to enqueue analysis job.',
      },
    });
    throw error;
  } finally {
    await queue.close();
  }
}

export async function retryBinAnalysisJob(analysisJobId: string, priority = 0) {
  const prisma = getPrismaClient();
  const analysisJob = await prisma.binAnalysisJob.findUnique({
    where: { id: analysisJobId },
  });

  if (!analysisJob) {
    throw new Error(`BinAnalysisJob not found: ${analysisJobId}`);
  }

  const queue = createBinAnalysisQueue();

  try {
    const bullJob = await queue.add(
      binAnalysisJobName,
      {
        analysisJobId: analysisJob.id,
        uploadId: analysisJob.uploadId,
      },
      {
        jobId: `${analysisJob.uploadId}-${analysisJob.id}-retry-${Date.now()}`,
        priority,
        attempts: getBinAnalysisAttempts(),
        backoff: {
          type: 'exponential',
          delay: getBinAnalysisBackoffMs(),
        },
      }
    );

    return prisma.binAnalysisJob.update({
      where: { id: analysisJob.id },
      data: {
        bullJobId: bullJob.id,
        status: 'QUEUED',
        stage: 'QUEUED',
        progress: 0,
        priority,
        maxAttempts: getBinAnalysisAttempts(),
        queuedAt: new Date(),
        failedAt: null,
        nextRetryAt: null,
        errorCode: null,
        errorMessage: null,
      },
    });
  } finally {
    await queue.close();
  }
}

export async function enqueueBinAnalysisJobForUpload(
  req: Request,
  input: EnqueueBinAnalysisInput
): Promise<void> {
  try {
    const result = await enqueueBinAnalysisJob(input);

    await writeAuditLog(req, {
      action: result.queued ? 'bin_analysis_job.queued' : 'bin_analysis_job.queue_skipped',
      entityType: 'BinAnalysisJob',
      entityId: result.job.id,
      metadata: {
        uploadId: input.uploadId,
        queueName: result.job.queueName,
        status: result.job.status,
      },
    });
  } catch (error) {
    logger.error({ err: error, uploadId: input.uploadId }, 'bin analysis enqueue failed');
    await writeAuditLog(req, {
      action: 'bin_analysis_job.queue_failed',
      entityType: 'BinUpload',
      entityId: input.uploadId,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown queue failure.',
      },
    });
  }
}
