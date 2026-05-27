import { disconnectPrismaClient } from '@caracal/db';
import { Worker } from 'bullmq';

import { getRedisConnectionOptions } from '../lib/bin-analysis/queue.js';
import {
  catalogQueueNames,
  closeCatalogQueues,
  getCatalogFxRatesQueue,
  type CatalogFxRatesJobData,
} from '../lib/catalog/queues.js';
import {
  FX_RATE_REFRESH_EVERY_MS,
  refreshFloatingCurrencyRates,
} from '../lib/catalog/fx-rates.js';
import { logger } from '../lib/logger.js';

const concurrency = Number.parseInt(process.env.CATALOG_FX_RATES_WORKER_CONCURRENCY ?? '1', 10);
const runOnce = process.argv.includes('--once');
let fxRatesWorker: Worker<CatalogFxRatesJobData> | null = null;

async function runFxRateRefresh(trigger: CatalogFxRatesJobData['trigger']) {
  const result = await refreshFloatingCurrencyRates();
  logger.info({ trigger, result }, 'catalog FX rates refresh completed');
  return result;
}

async function scheduleFxRateRefreshJobs(): Promise<void> {
  const queue = getCatalogFxRatesQueue();
  await queue.add(
    'refresh-rates',
    { type: 'refresh-rates', trigger: 'schedule' },
    {
      jobId: 'catalog-fx-rates-refresh-repeat',
      repeat: { every: FX_RATE_REFRESH_EVERY_MS },
    }
  );
  await queue.add('refresh-rates', { type: 'refresh-rates', trigger: 'boot' });
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'stopping catalog FX rates worker');
  await Promise.all([fxRatesWorker?.close(), closeCatalogQueues()]);
  process.exit(0);
}

if (runOnce) {
  try {
    const result = await runFxRateRefresh('manual');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    logger.error({ err: error }, 'catalog FX rates one-shot failed');
    process.exitCode = 1;
  } finally {
    await disconnectPrismaClient();
  }
} else {
  fxRatesWorker = new Worker<CatalogFxRatesJobData>(
    catalogQueueNames.fxRates,
    async (job) => {
      if (job.data.type !== 'refresh-rates') {
        throw new Error(`Unsupported FX rates job: ${JSON.stringify(job.data)}`);
      }

      return runFxRateRefresh(job.data.trigger);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency,
    }
  );

  fxRatesWorker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, 'catalog FX rates job completed');
  });

  fxRatesWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, err: error }, 'catalog FX rates job failed');
  });

  process.once('SIGINT', (signal) => void shutdown(signal));
  process.once('SIGTERM', (signal) => void shutdown(signal));

  void scheduleFxRateRefreshJobs()
    .then(() => {
      logger.info(
        {
          queue: catalogQueueNames.fxRates,
          concurrency,
          repeatEveryMs: FX_RATE_REFRESH_EVERY_MS,
        },
        'catalog FX rates worker started'
      );
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, 'catalog FX rates worker failed to schedule jobs');
      process.exit(1);
    });
}
