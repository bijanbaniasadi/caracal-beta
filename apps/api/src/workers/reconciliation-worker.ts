import { getPrismaClient } from '@caracal/db';
import { Worker } from 'bullmq';

import {
  catalogQueueNames,
  enqueueCatalogProjectionJob,
  type CatalogReconciliationJobData,
} from '../lib/catalog/queues.js';
import { refreshPublicProductsMaterializedViewDebounced } from '../lib/catalog/projection.js';
import { getRedisConnectionOptions } from '../lib/bin-analysis/queue.js';
import { logger } from '../lib/logger.js';

const concurrency = Number.parseInt(
  process.env.CATALOG_RECONCILIATION_WORKER_CONCURRENCY ?? '1',
  10
);

async function publicProductCount(): Promise<number> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM public_products
  `;

  return Number(rows[0]?.count ?? 0n);
}

const reconciliationWorker = new Worker<CatalogReconciliationJobData>(
  catalogQueueNames.reconciliation,
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'catalog reconciliation job started');

    await refreshPublicProductsMaterializedViewDebounced();

    const postgresCount = await publicProductCount();
    const queuedFullReindex = job.data.type === 'full-reconcile';

    if (queuedFullReindex) {
      await enqueueCatalogProjectionJob({
        type: 'full-reindex',
        reason: job.data.reason ?? 'reconciliation.count-mismatch',
      });
    }

    return {
      action: 'reconciliation-scan',
      postgresCount,
      queuedFullReindex,
    };
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency,
  }
);

reconciliationWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'catalog reconciliation job completed');
});

reconciliationWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, err: error }, 'catalog reconciliation job failed');
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'stopping catalog reconciliation worker');
  await reconciliationWorker.close();
  process.exit(0);
}

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));

logger.info(
  { queue: catalogQueueNames.reconciliation, concurrency },
  'catalog reconciliation worker skeleton started'
);
