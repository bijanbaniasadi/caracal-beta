import { getPrismaClient } from '@caracal/db';
import type { Prisma } from '@prisma/client';

import { enqueueCatalogFingerprintJob } from '../queues.js';
import { toPrismaJson } from '../../prisma-json.js';
import { logger } from '../../logger.js';
import { discoverMk3Products, downloadMk3Image } from './fetch.js';
import type { Mk3ExtractedProduct } from './extract.js';

export interface Mk3IngestionOptions {
  vendorSourceId?: string;
  requestedBy?: string;
  trigger: 'schedule' | 'manual';
  startUrls?: string[];
  maxPages?: number;
  limit?: number;
  fullCrawl?: boolean;
}

export interface Mk3RunSummary {
  ingestionRunId: string;
  importedCount: number;
  failedCount: number;
  reviewQueueCount: number;
  exactMatchCount: number;
  duplicateRawCount: number;
  rawImageCount: number;
}

interface Mk3IngestionError {
  url?: string;
  message: string;
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function triggerLabel(options: Mk3IngestionOptions): string {
  return options.requestedBy ? `${options.trigger}:userId=${options.requestedBy}` : options.trigger;
}

export async function ensureMk3VendorSource() {
  const prisma = getPrismaClient();

  return prisma.vendorSource.upsert({
    where: { slug: 'mk3' },
    create: {
      slug: 'mk3',
      name: 'MK3',
      baseUrl: 'https://www.mk3.com',
      enabled: true,
      scrapeCadence: '12 hours',
      notes: 'Phase C live staged ingestion source. Scraper writes raw staging only.',
    },
    update: {
      name: 'MK3',
      baseUrl: 'https://www.mk3.com',
      enabled: true,
      scrapeCadence: '12 hours',
      notes: 'Phase C live staged ingestion source. Scraper writes raw staging only.',
    },
  });
}

async function resolveMk3VendorSource(vendorSourceId?: string) {
  const prisma = getPrismaClient();
  const vendor = vendorSourceId
    ? await prisma.vendorSource.findUnique({ where: { id: BigInt(vendorSourceId) } })
    : await ensureMk3VendorSource();

  if (!vendor || vendor.slug !== 'mk3') {
    throw new Error('MK3 ingestion worker only accepts the mk3 vendor source.');
  }

  return vendor;
}

async function upsertRawImage(input: {
  rawProductId: bigint;
  originalUrl: string;
}): Promise<boolean> {
  const prisma = getPrismaClient();
  const existing = await prisma.vendorRawImage.findFirst({
    where: {
      rawProductId: input.rawProductId,
      originalUrl: input.originalUrl,
    },
  });

  try {
    const downloaded = await downloadMk3Image(input.originalUrl);
    const data = {
      storageKey: downloaded.storageKey,
      contentHash: downloaded.contentHash,
      mimeType: downloaded.mimeType,
      bytes: downloaded.bytes,
      downloadedAt: new Date(),
      downloadError: null,
    };

    if (existing) {
      await prisma.vendorRawImage.update({ where: { id: existing.id }, data });
      return false;
    }

    await prisma.vendorRawImage.create({
      data: {
        rawProductId: input.rawProductId,
        originalUrl: input.originalUrl,
        ...data,
      },
    });
    return true;
  } catch (error) {
    const data = {
      downloadError: stringifyError(error),
    };

    if (existing) {
      await prisma.vendorRawImage.update({ where: { id: existing.id }, data });
      return false;
    }

    await prisma.vendorRawImage.create({
      data: {
        rawProductId: input.rawProductId,
        originalUrl: input.originalUrl,
        ...data,
      },
    });
    return true;
  }
}

async function upsertRawProduct(input: {
  runId: bigint;
  vendorId: bigint;
  product: Mk3ExtractedProduct;
  rawHtmlStorageKey: string | null;
}): Promise<{ rawProductId: bigint; created: boolean }> {
  const prisma = getPrismaClient();
  const existingInRun = await prisma.vendorRawProduct.findUnique({
    where: {
      ingestionRunId_vendorId_vendorUrl: {
        ingestionRunId: input.runId,
        vendorId: input.vendorId,
        vendorUrl: input.product.vendorUrl,
      },
    },
    select: { id: true },
  });
  const existing =
    existingInRun ??
    (await prisma.vendorRawProduct.findFirst({
      where: {
        vendorId: input.vendorId,
        OR: [
          { vendorUrl: input.product.vendorUrl },
          ...(input.product.vendorSku ? [{ vendorSku: input.product.vendorSku }] : []),
        ],
      },
      orderBy: { scrapedAt: 'desc' },
      select: { id: true },
    }));

  const rawData = {
    vendorUrl: input.product.vendorUrl,
    vendorSku: input.product.vendorSku,
    rawName: input.product.rawName,
    rawDescription: input.product.rawDescription,
    rawPriceText: input.product.rawPriceText,
    parsedPriceCents: input.product.parsedPriceCents,
    parsedCurrency: input.product.parsedCurrency,
    rrpCents: input.product.rrpCents,
    rrpCurrency: input.product.rrpCurrency,
    parsedInStock: input.product.parsedInStock,
    rawSpecs: toPrismaJson(input.product.rawSpecs),
    rawImageUrls: input.product.rawImageUrls,
    rawHtmlStorageKey: input.rawHtmlStorageKey,
    fingerprint: input.product.fingerprint,
    scrapedAt: new Date(),
  };
  const data = {
    ingestionRun: { connect: { id: input.runId } },
    ...rawData,
  } satisfies Prisma.VendorRawProductUpdateInput;

  if (existing) {
    const updated = await prisma.vendorRawProduct.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    });
    return { rawProductId: updated.id, created: false };
  }

  const created = await prisma.vendorRawProduct.create({
    data: {
      ingestionRunId: input.runId,
      vendorId: input.vendorId,
      ...rawData,
    },
    select: { id: true },
  });

  return { rawProductId: created.id, created: true };
}

export async function summarizeMk3IngestionRun(runId: string): Promise<Mk3RunSummary> {
  const prisma = getPrismaClient();
  const id = BigInt(runId);
  const run = await prisma.ingestionRun.findUnique({
    where: { id },
    include: { vendor: true },
  });

  if (!run || run.vendor.slug !== 'mk3') {
    throw new Error('MK3 ingestion run not found.');
  }

  const [importedCount, reviewQueueCount, exactMatchCount, rawImageCount] = await Promise.all([
    prisma.vendorRawProduct.count({ where: { ingestionRunId: id } }),
    prisma.reviewQueue.count({ where: { rawProduct: { ingestionRunId: id } } }),
    prisma.vendorRawProduct.count({
      where: { ingestionRunId: id, matchStatus: 'AUTO_MATCHED', matchConfidence: 1 },
    }),
    prisma.vendorRawImage.count({ where: { rawProduct: { ingestionRunId: id } } }),
  ]);
  const duplicateRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    WITH duplicate_urls AS (
      SELECT vendor_url
      FROM vendor_raw_products
      WHERE ingestion_run_id = ${id}
      GROUP BY vendor_url
      HAVING COUNT(*) > 1
    ),
    duplicate_skus AS (
      SELECT vendor_sku
      FROM vendor_raw_products
      WHERE ingestion_run_id = ${id}
        AND vendor_sku IS NOT NULL
      GROUP BY vendor_sku
      HAVING COUNT(*) > 1
    )
    SELECT (
      (SELECT COUNT(*) FROM duplicate_urls) +
      (SELECT COUNT(*) FROM duplicate_skus)
    )::bigint AS count
  `;
  const errors = Array.isArray(run.errors) ? run.errors : [];

  return {
    ingestionRunId: run.id.toString(),
    importedCount,
    failedCount: errors.length,
    reviewQueueCount,
    exactMatchCount,
    duplicateRawCount: Number(duplicateRows[0]?.count ?? 0n),
    rawImageCount,
  };
}

export async function runMk3Ingestion(options: Mk3IngestionOptions): Promise<Mk3RunSummary> {
  const prisma = getPrismaClient();
  const vendor = await resolveMk3VendorSource(options.vendorSourceId);
  const run = await prisma.ingestionRun.create({
    data: {
      vendorId: vendor.id,
      status: 'RUNNING',
      triggeredBy: triggerLabel(options),
    },
  });
  const errors: Mk3IngestionError[] = [];
  let importedCount = 0;
  let duplicateRawCount = 0;
  let rawImageCount = 0;

  try {
    const pages = await discoverMk3Products({
      baseUrl: vendor.baseUrl,
      startUrls: options.startUrls,
      maxPages: options.maxPages,
      limit: options.limit,
      fullCrawl: options.fullCrawl,
    });
    const seenUrls = new Set<string>();

    for (const page of pages) {
      for (const product of page.products) {
        try {
          if (seenUrls.has(product.vendorUrl)) {
            duplicateRawCount += 1;
          }
          seenUrls.add(product.vendorUrl);

          const raw = await upsertRawProduct({
            runId: run.id,
            vendorId: vendor.id,
            product,
            rawHtmlStorageKey: page.rawHtmlStorageKey,
          });

          if (!raw.created) duplicateRawCount += 1;
          importedCount += 1;

          for (const originalUrl of product.rawImageUrls) {
            const created = await upsertRawImage({
              rawProductId: raw.rawProductId,
              originalUrl,
            });
            if (created) rawImageCount += 1;
          }

          await enqueueCatalogFingerprintJob({ rawProductId: raw.rawProductId.toString() });
        } catch (error) {
          errors.push({ url: product.vendorUrl, message: stringifyError(error) });
        }
      }
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: errors.length > 0 ? 'PARTIAL' : 'COMPLETED',
        finishedAt: new Date(),
        pagesScraped: pages.length,
        productsFound: importedCount,
        errors: toPrismaJson(errors),
      },
    });
  } catch (error) {
    errors.push({ message: stringifyError(error) });
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: importedCount > 0 ? 'PARTIAL' : 'FAILED',
        finishedAt: new Date(),
        productsFound: importedCount,
        errors: toPrismaJson(errors),
      },
    });
  }

  const summary = await summarizeMk3IngestionRun(run.id.toString());

  logger.info(
    { runId: run.id.toString(), ...summary, duplicateRawCount, rawImageCount },
    'MK3 staged ingestion completed'
  );

  return summary;
}
