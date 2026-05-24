import 'dotenv/config';

import { disconnectPrismaClient } from '@caracal/db';
import { Worker } from 'bullmq';

import {
  binAnalysisJobName,
  binAnalysisQueueName,
  createBinAnalysisQueue,
  getRedisConnectionOptions,
  type BinAnalysisJobData,
} from '../lib/bin-analysis/queue.js';
import {
  createWorkerId,
  markWorkerHeartbeat,
  startWorkerHeartbeat,
} from '../lib/bin-analysis/heartbeat.js';
import { startQueueMaintenanceCron } from '../lib/bin-analysis/maintenance.js';
import { markBinAnalysisJobFailed, processBinAnalysisJob } from '../lib/bin-analysis/processor.js';
import { logger } from '../lib/logger.js';

const concurrency = Number.parseInt(process.env.BIN_ANALYSIS_WORKER_CONCURRENCY ?? '2', 10);
const workerId =
  process.env.BIN_ANALYSIS_WORKER_ID ?? createWorkerId('bin-analysis-worker', binAnalysisQueueName);
const heartbeatConfig = {
  workerId,
  workerType: 'bin-analysis-worker',
  queueName: binAnalysisQueueName,
  concurrency,
  metadata: {
    runtime: 'node',
    pid: process.pid,
  },
};
const maintenanceQueue = createBinAnalysisQueue();
const stopHeartbeat = startWorkerHeartbeat(heartbeatConfig);
const stopMaintenance = startQueueMaintenanceCron(maintenanceQueue);
let shuttingDown = false;

const worker = new Worker<BinAnalysisJobData>(
  binAnalysisQueueName,
  async (job) => {
    if (job.name !== binAnalysisJobName) {
      throw new Error(`Unsupported BIN analysis job type: ${job.name}`);
    }

    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts =
      job.opts.attempts ?? Number.parseInt(process.env.BIN_ANALYSIS_MAX_ATTEMPTS ?? '3', 10);

    try {
      return await processBinAnalysisJob({
        analysisJobId: job.data.analysisJobId,
        uploadId: job.data.uploadId,
        attemptNumber,
        maxAttempts,
        reportProgress: (progress) => job.updateProgress(progress),
      });
    } catch (error) {
      await markBinAnalysisJobFailed(job.data.analysisJobId, error, attemptNumber, maxAttempts);
      throw error;
    }
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency,
    lockDuration: Number.parseInt(process.env.BIN_ANALYSIS_LOCK_DURATION_MS ?? '30000', 10),
    stalledInterval: Number.parseInt(process.env.BIN_ANALYSIS_STALLED_INTERVAL_MS ?? '30000', 10),
    maxStalledCount: Number.parseInt(process.env.BIN_ANALYSIS_MAX_STALLED_COUNT ?? '2', 10),
  }
);

worker.on('ready', () => {
  logger.info(
    { queueName: binAnalysisQueueName, concurrency, workerId },
    'BIN analysis worker ready'
  );
});

worker.on('completed', (job) => {
  logger.info(
    {
      bullJobId: job.id,
      analysisJobId: job.data.analysisJobId,
      uploadId: job.data.uploadId,
    },
    'BIN analysis job completed'
  );
});

worker.on('failed', (job, error) => {
  logger.error(
    {
      err: error,
      bullJobId: job?.id,
      analysisJobId: job?.data.analysisJobId,
      uploadId: job?.data.uploadId,
    },
    'BIN analysis job failed'
  );
});

worker.on('error', (error) => {
  logger.error(
    { err: error, queueName: binAnalysisQueueName, workerId },
    'BIN analysis worker error'
  );
  void markWorkerHeartbeat(heartbeatConfig, 'ERROR', {
    error: error.message,
  });
});

worker.on('stalled', (jobId) => {
  logger.warn(
    { bullJobId: jobId, queueName: binAnalysisQueueName, workerId },
    'BIN analysis job stalled'
  );
});

async function safeMarkWorkerHeartbeat(
  status: 'ONLINE' | 'STOPPING' | 'OFFLINE' | 'ERROR',
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await markWorkerHeartbeat(heartbeatConfig, status, metadata);
  } catch (error) {
    logger.error({ err: error, status, workerId }, 'worker heartbeat status update failed');
  }
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal, workerId }, 'shutting down BIN analysis worker');
  stopMaintenance();
  await safeMarkWorkerHeartbeat('STOPPING', { signal });

  const timeoutMs = Number.parseInt(process.env.WORKER_SHUTDOWN_TIMEOUT_MS ?? '30000', 10);
  const shutdownWork = Promise.allSettled([
    worker.close(),
    maintenanceQueue.close(),
    stopHeartbeat(),
    disconnectPrismaClient(),
  ]).then((results) => {
    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error({ err: result.reason, workerId }, 'BIN analysis worker shutdown step failed');
      }
    }
  });

  await Promise.race([
    shutdownWork,
    new Promise((resolve) => {
      setTimeout(resolve, timeoutMs).unref();
    }),
  ]);

  process.exit(0);
}

process.on('SIGINT', (signal) => {
  void shutdown(signal);
});
process.on('SIGTERM', (signal) => {
  void shutdown(signal);
});
