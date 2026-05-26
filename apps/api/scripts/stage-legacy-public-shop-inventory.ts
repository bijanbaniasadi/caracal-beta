import 'dotenv/config';

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Prisma,
  PrismaClient,
  type InventoryStatus,
  type VendorProductMatchStatus,
} from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const defaultCsvPath =
  process.env.LEGACY_PUBLIC_SHOP_CSV ??
  (existsSync('C:\\Codex\\caracal_live_shop_inventory_with_sku.csv')
    ? 'C:\\Codex\\caracal_live_shop_inventory_with_sku.csv'
    : path.join(projectRoot, 'docs/legacy-migration/caracal_live_shop_inventory_with_sku.csv'));

const prisma = new PrismaClient();
const DEFAULT_SOURCE_SLUG = 'legacy-public-shop';
const DEFAULT_SOURCE_NAME = 'Legacy Public Shop';
const DEFAULT_SOURCE_BASE_URL = 'https://caracaltechmotors.com/shop.php';
const DEFAULT_BATCH_SIZE = 250;

interface ImportOptions {
  csvPath: string;
  dryRun: boolean;
  limit: number | null;
  batchSize: number;
  sourceSlug: string;
  sourceName: string;
  sourceBaseUrl: string;
  skipHistory: boolean;
}

interface CsvRow {
  category_slug?: string;
  category_name?: string;
  public_product_id?: string;
  slug?: string;
  title?: string;
  price_aed?: string;
  compare_price_aed?: string;
  discount_badge?: string;
  product_url?: string;
  image_url?: string;
  stock_note?: string;
  detail_product_id?: string;
  sku?: string;
  stock_label?: string;
  detail_price_aed?: string;
  detail_compare_price_aed?: string;
  detail_title?: string;
  detail_fetch_error?: string;
}

interface NormalizedRow {
  sourceProductKey: string;
  externalUrl: string;
  sku: string | null;
  normalizedSku: string | null;
  name: string;
  normalizedName: string;
  categoryName: string | null;
  categorySlug: string | null;
  rawPriceCents: number | null;
  compareAtPriceCents: number | null;
  discountPercent: number;
  stockStatus: InventoryStatus;
  stockLabel: string | null;
  imageUrl: string | null;
  publicProductId: string | null;
  matchStatus: VendorProductMatchStatus;
  warnings: string[];
  rejectReasons: string[];
  rawData: CsvRow;
}

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) || null : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseInteger(value: string | null, fallback: number | null): number | null {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseOptions(): ImportOptions {
  return {
    csvPath: argValue('file') ?? defaultCsvPath,
    dryRun: hasFlag('dry-run'),
    limit: parseInteger(argValue('limit'), null),
    batchSize: parseInteger(argValue('batch-size'), DEFAULT_BATCH_SIZE) ?? DEFAULT_BATCH_SIZE,
    sourceSlug: argValue('source-slug') ?? DEFAULT_SOURCE_SLUG,
    sourceName: argValue('source-name') ?? DEFAULT_SOURCE_NAME,
    sourceBaseUrl: argValue('source-base-url') ?? DEFAULT_SOURCE_BASE_URL,
    skipHistory: hasFlag('skip-history'),
  };
}

function parseCsv(source: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }

  const headers = (rows.shift() ?? []).map((header) => header.replace(/^\uFEFF/, '').trim());
  return rows.map((values) => {
    const record: Record<string, string> = {};
    for (const [index, header] of headers.entries()) {
      record[header] = values[index]?.trim() ?? '';
    }
    return record as CsvRow;
  });
}

function compactText(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

function normalizeSku(value: string | null | undefined): string | null {
  const sku = compactText(value)
    ?.toUpperCase()
    .replace(/[^\w.-]+/g, '');
  return sku ? sku.slice(0, 100) : null;
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(value: string, length = 20): string {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

function moneyToCents(value: string | null | undefined): number | null {
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function mapStockStatus(value: string | null | undefined): InventoryStatus {
  const text = String(value ?? '').toLowerCase();
  if (/discontinued/.test(text)) return 'DISCONTINUED';
  if (/out of stock|sold out|temporarily unavailable|unavailable/.test(text)) {
    return 'OUT_OF_STOCK';
  }
  if (/low stock/.test(text)) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function discountPercent(priceCents: number | null, compareAtPriceCents: number | null): number {
  if (!priceCents || !compareAtPriceCents || compareAtPriceCents <= priceCents) return 0;
  return Math.max(0, Math.min(100, Math.round(100 - (priceCents / compareAtPriceCents) * 100)));
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function normalizeRow(row: CsvRow, sourceSlug: string): NormalizedRow {
  const sku = compactText(row.sku) ?? compactText(row.public_product_id);
  const normalizedSku = normalizeSku(sku);
  const title = compactText(row.detail_title) ?? compactText(row.title) ?? '';
  const normalizedName = normalizeTitle(title);
  const externalUrl =
    compactText(row.product_url) ?? `urn:${sourceSlug}:${normalizedSku ?? hash(title)}`;
  const sourceProductKey = normalizedSku ? `sku:${normalizedSku}` : `url:${hash(externalUrl)}`;
  const rawPriceCents = moneyToCents(row.detail_price_aed) ?? moneyToCents(row.price_aed);
  const compareAtPriceCents =
    moneyToCents(row.detail_compare_price_aed) ?? moneyToCents(row.compare_price_aed);
  const stockLabel = compactText(row.stock_label);
  const stockStatus = mapStockStatus(stockLabel);
  const warnings: string[] = ['exact_stock_quantity_not_available_from_public_shop'];
  const rejectReasons: string[] = [];

  if (!normalizedSku) warnings.push('missing_sku');
  if (!title) rejectReasons.push('missing_name');
  if (!rawPriceCents || rawPriceCents <= 0) rejectReasons.push('missing_or_invalid_price');
  if (!compactText(row.image_url)) warnings.push('missing_image');
  if (row.detail_fetch_error) warnings.push('detail_fetch_error_present');
  if (stockStatus === 'OUT_OF_STOCK') warnings.push('public_stock_status_not_available');
  if (normalizedSku === 'TEST' || normalizedName === 'test') rejectReasons.push('test_product');

  return {
    sourceProductKey,
    externalUrl,
    sku,
    normalizedSku,
    name: title,
    normalizedName,
    categoryName: compactText(row.category_name),
    categorySlug: compactText(row.category_slug),
    rawPriceCents,
    compareAtPriceCents,
    discountPercent: discountPercent(rawPriceCents, compareAtPriceCents),
    stockStatus,
    stockLabel,
    imageUrl: compactText(row.image_url),
    publicProductId: compactText(row.detail_product_id) ?? compactText(row.public_product_id),
    matchStatus: 'UNMAPPED',
    warnings,
    rejectReasons,
    rawData: row,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function loadMatchedProducts(): Promise<
  Map<string, { id: string; sku: string; name: string; priceCents: number | null; status: string }>
> {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      sku: true,
      name: true,
      priceCents: true,
      status: true,
    },
  });

  const bySku = new Map<
    string,
    { id: string; sku: string; name: string; priceCents: number | null; status: string }
  >();

  for (const product of products) {
    const key = normalizeSku(product.sku);
    if (key && !bySku.has(key)) {
      bySku.set(key, product);
    }
  }

  return bySku;
}

async function upsertSource(options: ImportOptions) {
  return prisma.supplierSource.upsert({
    where: { slug: options.sourceSlug },
    update: {
      name: options.sourceName,
      baseUrl: options.sourceBaseUrl,
      currency: 'AED',
      isActive: true,
      scrapeAllowed: true,
      metadata: toJson({
        source: 'legacy-public-shop',
        importFile: options.csvPath,
        importer: 'stage-legacy-public-shop-inventory',
      }),
    },
    create: {
      slug: options.sourceSlug,
      name: options.sourceName,
      baseUrl: options.sourceBaseUrl,
      currency: 'AED',
      isActive: true,
      scrapeAllowed: true,
      metadata: toJson({
        source: 'legacy-public-shop',
        importFile: options.csvPath,
        importer: 'stage-legacy-public-shop-inventory',
      }),
    },
  });
}

async function upsertRow(input: {
  row: NormalizedRow;
  sourceId: string;
  runId: string | null;
  matchedProduct:
    | { id: string; sku: string; name: string; priceCents: number | null; status: string }
    | undefined;
  skipHistory: boolean;
}) {
  const { row, sourceId, runId, matchedProduct, skipHistory } = input;
  const now = new Date();
  const matchStatus: VendorProductMatchStatus = matchedProduct ? 'SUGGESTED' : 'UNMAPPED';

  const stagingProduct = await prisma.stagingProduct.upsert({
    where: {
      sourceId_sourceProductKey: {
        sourceId,
        sourceProductKey: row.sourceProductKey,
      },
    },
    update: {
      runId,
      matchedProductId: matchedProduct?.id ?? null,
      externalUrl: row.externalUrl,
      externalSku: row.sku,
      normalizedSku: row.normalizedSku,
      externalName: row.name,
      normalizedName: row.normalizedName,
      brand: null,
      categoryName: row.categoryName,
      rawPriceCents: row.rawPriceCents,
      rawCurrency: 'AED',
      convertedPriceCents: row.rawPriceCents,
      salePriceCents: row.rawPriceCents,
      oldPriceCents: row.compareAtPriceCents,
      discountPercent: row.discountPercent,
      marginPercent: 0,
      stockStatus: row.stockStatus,
      imageUrl: row.imageUrl,
      imageApproved: false,
      status: 'PENDING',
      warnings: toJson(row.warnings),
      rejectReasons: toJson(row.rejectReasons),
      readyChecklist: toJson({
        skuPresent: Boolean(row.normalizedSku),
        namePresent: Boolean(row.name),
        pricePresent: Boolean(row.rawPriceCents),
        exactStockQuantityAvailable: false,
        imageRequiresReview: Boolean(row.imageUrl),
        matchedExistingProduct: Boolean(matchedProduct),
      }),
      rawData: toJson(row.rawData),
      normalizedData: toJson({
        source: 'legacy-public-shop',
        publicProductId: row.publicProductId,
        categorySlug: row.categorySlug,
        stockLabel: row.stockLabel,
        compareAtPriceCents: row.compareAtPriceCents,
        importedAs: 'pending-staging-only',
      }),
      lastSeenAt: now,
    },
    create: {
      sourceId,
      runId,
      matchedProductId: matchedProduct?.id ?? null,
      sourceProductKey: row.sourceProductKey,
      externalUrl: row.externalUrl,
      externalSku: row.sku,
      normalizedSku: row.normalizedSku,
      externalName: row.name,
      normalizedName: row.normalizedName,
      brand: null,
      categoryName: row.categoryName,
      rawPriceCents: row.rawPriceCents,
      rawCurrency: 'AED',
      convertedPriceCents: row.rawPriceCents,
      salePriceCents: row.rawPriceCents,
      oldPriceCents: row.compareAtPriceCents,
      discountPercent: row.discountPercent,
      marginPercent: 0,
      stockStatus: row.stockStatus,
      imageUrl: row.imageUrl,
      imageApproved: false,
      status: 'PENDING',
      warnings: toJson(row.warnings),
      rejectReasons: toJson(row.rejectReasons),
      readyChecklist: toJson({
        skuPresent: Boolean(row.normalizedSku),
        namePresent: Boolean(row.name),
        pricePresent: Boolean(row.rawPriceCents),
        exactStockQuantityAvailable: false,
        imageRequiresReview: Boolean(row.imageUrl),
        matchedExistingProduct: Boolean(matchedProduct),
      }),
      rawData: toJson(row.rawData),
      normalizedData: toJson({
        source: 'legacy-public-shop',
        publicProductId: row.publicProductId,
        categorySlug: row.categorySlug,
        stockLabel: row.stockLabel,
        compareAtPriceCents: row.compareAtPriceCents,
        importedAs: 'pending-staging-only',
      }),
    },
  });

  const vendorProduct = await prisma.vendorProduct.upsert({
    where: {
      sourceId_sourceProductKey: {
        sourceId,
        sourceProductKey: row.sourceProductKey,
      },
    },
    update: {
      productId: matchedProduct?.id ?? null,
      stagingProductId: stagingProduct.id,
      vendorSku: row.sku,
      normalizedSku: row.normalizedSku,
      vendorTitle: row.name,
      normalizedTitle: row.normalizedName,
      vendorUrl: row.externalUrl,
      brand: null,
      categoryName: row.categoryName,
      imageUrl: row.imageUrl,
      matchStatus,
      lastSeenAt: now,
      metadata: toJson({
        source: 'legacy-public-shop',
        publicProductId: row.publicProductId,
        categorySlug: row.categorySlug,
      }),
    },
    create: {
      sourceId,
      productId: matchedProduct?.id ?? null,
      stagingProductId: stagingProduct.id,
      sourceProductKey: row.sourceProductKey,
      vendorSku: row.sku,
      normalizedSku: row.normalizedSku,
      vendorTitle: row.name,
      normalizedTitle: row.normalizedName,
      vendorUrl: row.externalUrl,
      brand: null,
      categoryName: row.categoryName,
      imageUrl: row.imageUrl,
      matchStatus,
      metadata: toJson({
        source: 'legacy-public-shop',
        publicProductId: row.publicProductId,
        categorySlug: row.categorySlug,
      }),
    },
  });

  if (!skipHistory) {
    await prisma.rawPriceHistory.create({
      data: {
        vendorProductId: vendorProduct.id,
        sourceId,
        productId: matchedProduct?.id ?? null,
        rawPriceCents: row.rawPriceCents,
        rawCurrency: 'AED',
        normalizedPriceCents: row.rawPriceCents,
        normalizedCurrency: 'AED',
        availability: row.stockStatus,
        sourceUrl: row.externalUrl,
        discountBadge: compactText(row.rawData.discount_badge),
        scrapedAt: now,
        metadata: toJson({
          supplierSyncRunId: runId,
          stockLabel: row.stockLabel,
          compareAtPriceCents: row.compareAtPriceCents,
          importer: 'stage-legacy-public-shop-inventory',
        }),
      },
    });
  }

  return {
    stagingProductId: stagingProduct.id,
    vendorProductId: vendorProduct.id,
    matched: Boolean(matchedProduct),
    warningCount: row.warnings.length,
    rejectReasonCount: row.rejectReasons.length,
  };
}

function summarize(rows: NormalizedRow[]) {
  const byStock = new Map<string, number>();
  const byCategory = new Map<string, number>();
  let rejectFlagged = 0;
  let warningFlagged = 0;

  for (const row of rows) {
    byStock.set(row.stockStatus, (byStock.get(row.stockStatus) ?? 0) + 1);
    byCategory.set(
      row.categorySlug ?? 'uncategorized',
      (byCategory.get(row.categorySlug ?? 'uncategorized') ?? 0) + 1
    );
    if (row.rejectReasons.length > 0) rejectFlagged += 1;
    if (row.warnings.length > 0) warningFlagged += 1;
  }

  return {
    total: rows.length,
    byStock: Object.fromEntries([...byStock.entries()].sort()),
    byCategory: Object.fromEntries([...byCategory.entries()].sort()),
    warningFlagged,
    rejectFlagged,
    sample: rows.slice(0, 5).map((row) => ({
      sku: row.normalizedSku,
      name: row.name,
      priceCents: row.rawPriceCents,
      stockStatus: row.stockStatus,
      warnings: row.warnings,
      rejectReasons: row.rejectReasons,
    })),
  };
}

async function main() {
  const options = parseOptions();
  const csv = await readFile(options.csvPath, 'utf8');
  const parsedRows = parseCsv(csv);
  const selectedRows = options.limit === null ? parsedRows : parsedRows.slice(0, options.limit);
  const normalizedRows = selectedRows.map((row) => normalizeRow(row, options.sourceSlug));

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          file: options.csvPath,
          sourceSlug: options.sourceSlug,
          ...summarize(normalizedRows),
        },
        null,
        2
      )
    );
    return;
  }

  const source = await upsertSource(options);
  const run = await prisma.supplierSyncRun.create({
    data: {
      sourceId: source.id,
      mode: 'STAGE',
      status: 'RUNNING',
      discoveredCount: normalizedRows.length,
      metadata: toJson({
        file: options.csvPath,
        importer: 'stage-legacy-public-shop-inventory',
        skipHistory: options.skipHistory,
      }),
    },
  });

  try {
    const productBySku = await loadMatchedProducts();
    let processed = 0;
    let matched = 0;
    let warningFlagged = 0;
    let rejectFlagged = 0;

    for (const rows of chunk(normalizedRows, options.batchSize)) {
      for (const row of rows) {
        const matchedProduct = row.normalizedSku ? productBySku.get(row.normalizedSku) : undefined;
        const result = await upsertRow({
          row,
          sourceId: source.id,
          runId: run.id,
          matchedProduct,
          skipHistory: options.skipHistory,
        });

        processed += 1;
        if (result.matched) matched += 1;
        if (result.warningCount > 0) warningFlagged += 1;
        if (result.rejectReasonCount > 0) rejectFlagged += 1;
      }

      console.log(`staged ${processed}/${normalizedRows.length}`);
    }

    await prisma.supplierSyncRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        finishedAt: new Date(),
        discoveredCount: normalizedRows.length,
        stagedCount: processed,
        reviewCount: processed,
        acceptedCount: 0,
        rejectedCount: 0,
        publishedCount: 0,
        metadata: toJson({
          file: options.csvPath,
          importer: 'stage-legacy-public-shop-inventory',
          skipHistory: options.skipHistory,
          matchedBySku: matched,
          warningFlagged,
          rejectFlagged,
          note: 'All imported rows are left as PENDING for admin review.',
        }),
      },
    });

    console.log(
      JSON.stringify(
        {
          status: 'COMPLETED',
          sourceId: source.id,
          runId: run.id,
          staged: processed,
          pending: processed,
          matchedBySku: matched,
          warningFlagged,
          rejectFlagged,
        },
        null,
        2
      )
    );
  } catch (error) {
    await prisma.supplierSyncRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
