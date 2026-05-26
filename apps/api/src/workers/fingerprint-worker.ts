import { Worker } from 'bullmq';

import { catalogQueueNames, type CatalogFingerprintJobData } from '../lib/catalog/queues.js';
import { processMk3RawProductFingerprint } from '../lib/catalog/mk3/matching.js';
import { getRedisConnectionOptions } from '../lib/bin-analysis/queue.js';
import { logger } from '../lib/logger.js';

const concurrency = Number.parseInt(process.env.CATALOG_FINGERPRINT_WORKER_CONCURRENCY ?? '1', 10);

const fingerprintWorker = new Worker<CatalogFingerprintJobData>(
  catalogQueueNames.fingerprint,
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'catalog fingerprint skeleton received job');

    if (job.data.rawProductId) {
      return processMk3RawProductFingerprint(job.data.rawProductId);
    }

    return {
      action: 'fingerprint-placeholder',
      owns: [
        'vendor_raw_products.match_*',
        'vendor_offers',
        'price_history',
        'review_queue',
      ],
      masterProductMutationAllowed: false,
    };
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency,
  }
);

fingerprintWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'catalog fingerprint job completed');
});

fingerprintWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, err: error }, 'catalog fingerprint job failed');
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'stopping catalog fingerprint worker');
  await fingerprintWorker.close();
  process.exit(0);
}

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));

logger.info(
  { queue: catalogQueueNames.fingerprint, concurrency },
  'catalog fingerprint worker skeleton started'
);
