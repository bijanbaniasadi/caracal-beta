import { Worker } from 'bullmq';

import { catalogQueueNames, type CatalogImagePipelineJobData } from '../lib/catalog/queues.js';
import { getRedisConnectionOptions } from '../lib/bin-analysis/queue.js';
import { logger } from '../lib/logger.js';

const concurrency = Number.parseInt(
  process.env.CATALOG_IMAGE_PIPELINE_WORKER_CONCURRENCY ?? '1',
  10
);

const imagePipelineWorker = new Worker<CatalogImagePipelineJobData>(
  catalogQueueNames.imagePipeline,
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'catalog image pipeline skeleton received job');

    return {
      action: 'image-pipeline-placeholder',
      owns: ['vendor_raw_images.storage_key', 'product_images.insert_on_admin_promote'],
      statusMutationAllowed: false,
    };
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency,
  }
);

imagePipelineWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'catalog image pipeline job completed');
});

imagePipelineWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, err: error }, 'catalog image pipeline job failed');
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'stopping catalog image pipeline worker');
  await imagePipelineWorker.close();
  process.exit(0);
}

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));

logger.info(
  { queue: catalogQueueNames.imagePipeline, concurrency },
  'catalog image pipeline worker skeleton started'
);
