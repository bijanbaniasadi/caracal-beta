import { Worker } from 'bullmq';

import {
  catalogQueueNames,
  enqueueCatalogProjectionJob,
  type CatalogProjectionJobData,
  type CatalogSearchIndexJobData,
} from '../lib/catalog/queues.js';
import {
  projectMasterProductToSearch,
  refreshPublicProductsMaterializedViewDebounced,
  reindexAllPublicProductsWithAliasSwap,
} from '../lib/catalog/projection.js';
import { getRedisConnectionOptions } from '../lib/bin-analysis/queue.js';
import { logger } from '../lib/logger.js';

const concurrency = Number.parseInt(process.env.CATALOG_PROJECTION_WORKER_CONCURRENCY ?? '1', 10);

const projectionWorker = new Worker<CatalogProjectionJobData>(
  catalogQueueNames.projection,
  async (job) => {
    if (job.data.type === 'refresh-matview') {
      return refreshPublicProductsMaterializedViewDebounced();
    }

    if (job.data.type === 'project-product' && job.data.masterProductId) {
      await refreshPublicProductsMaterializedViewDebounced();
      return projectMasterProductToSearch(job.data.masterProductId);
    }

    if (job.data.type === 'full-reindex') {
      return reindexAllPublicProductsWithAliasSwap();
    }

    throw new Error(`Unsupported projection job: ${JSON.stringify(job.data)}`);
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency,
  }
);

const searchIndexWorker = new Worker<CatalogSearchIndexJobData>(
  catalogQueueNames.searchIndex,
  async (job) => {
    if ((job.data.type === 'upsert' || job.data.type === 'delete') && job.data.masterProductId) {
      await enqueueCatalogProjectionJob({
        type: 'project-product',
        masterProductId: job.data.masterProductId,
        publicId: job.data.publicId,
        reason: job.data.reason ?? `search-index.${job.data.type}`,
      });

      return { action: 'delegated-to-projection' };
    }

    if (job.data.type === 'reindex-full') {
      await enqueueCatalogProjectionJob({
        type: 'full-reindex',
        reason: job.data.reason ?? 'search-index.reindex-full',
      });

      return { action: 'delegated-full-reindex-to-projection' };
    }

    throw new Error(`Unsupported search-index job: ${JSON.stringify(job.data)}`);
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency,
  }
);

projectionWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'catalog projection job completed');
});

projectionWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, err: error }, 'catalog projection job failed');
});

searchIndexWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'catalog search-index job completed');
});

searchIndexWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, err: error }, 'catalog search-index job failed');
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'stopping catalog projection worker');
  await Promise.all([projectionWorker.close(), searchIndexWorker.close()]);
  process.exit(0);
}

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));

logger.info(
  {
    projectionQueue: catalogQueueNames.projection,
    searchIndexQueue: catalogQueueNames.searchIndex,
    concurrency,
  },
  'catalog projection worker started'
);
