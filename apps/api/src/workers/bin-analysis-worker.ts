import 'dotenv/config';

import { disconnectPrismaClient } from '@caracal/db';
import { Worker } from 'bullmq';

import {
  binAnalysisJobName,
  binAnalysisQueueName,
  getRedisConnectionOptions,
  type BinAnalysisJobData,
} from '../lib/bin-analysis/queue.js';
import { markBinAnalysisJobFailed, processBinAnalysisJob } from '../lib/bin-analysis/processor.js';
import { logger } from '../lib/logger.js';

const concurrency = Number.parseInt(process.env.BIN_ANALYSIS_WORKER_CONCURRENCY ?? '2', 10);

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
  }
);

worker.on('ready', () => {
  logger.info({ queueName: binAnalysisQueueName, concurrency }, 'BIN analysis worker ready');
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

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'shutting down BIN analysis worker');
  await worker.close();
  await disconnectPrismaClient();
  process.exit(0);
}

process.on('SIGINT', (signal) => {
  void shutdown(signal);
});
process.on('SIGTERM', (signal) => {
  void shutdown(signal);
});
