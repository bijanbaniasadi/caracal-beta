import { Worker } from 'bullmq';

import { catalogQueueNames, type CatalogIngestionJobData } from '../lib/catalog/queues.js';
import { getRedisConnectionOptions } from '../lib/bin-analysis/queue.js';
import { logger } from '../lib/logger.js';

const concurrency = Number.parseInt(process.env.CATALOG_INGESTION_WORKER_CONCURRENCY ?? '1', 10);

const ingestionWorker = new Worker<CatalogIngestionJobData>(
  catalogQueueNames.ingestion,
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'catalog ingestion skeleton received job');

    return {
      action: 'ingestion-placeholder',
      owns: ['ingestion_runs', 'vendor_raw_products', 'vendor_raw_images'],
      scrapersImplemented: false,
    };
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency,
  }
);

ingestionWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'catalog ingestion job completed');
});

ingestionWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, err: error }, 'catalog ingestion job failed');
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'stopping catalog ingestion worker');
  await ingestionWorker.close();
  process.exit(0);
}

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));

logger.info(
  { queue: catalogQueueNames.ingestion, concurrency },
  'catalog ingestion worker skeleton started'
);
