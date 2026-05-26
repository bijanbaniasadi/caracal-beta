import 'dotenv/config';

import { createHash } from 'node:crypto';
import { stdin } from 'node:process';

import { Prisma, PrismaClient, type InventoryStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface StagingProductInput {
  sourceSlug: string;
  sourceName: string;
  sourceBaseUrl: string;
  sourceCurrency?: string;
  externalUrl: string;
  sku?: string | null;
  name: string;
  brand?: string | null;
  categoryName?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  stockStatus?: InventoryStatus | string | null;
  imageUrl?: string | null;
  rawData?: unknown;
}

const USD_AED = Number.parseFloat(process.env.SUPPLIER_SYNC_USD_AED ?? '3.67');
const EUR_AED = Number.parseFloat(process.env.SUPPLIER_SYNC_EUR_AED ?? '4.00');
const GBP_AED = Number.parseFloat(process.env.SUPPLIER_SYNC_GBP_AED ?? '4.70');

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function hash(value: string, length = 14): string {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

function normalizeSku(value: string | null | undefined): string | null {
  const sku = value?.trim().toUpperCase().replace(/[^\w.-]+/g, '');
  return sku ? sku.slice(0, 80) : null;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sourceProductKey(sourceSlug: string, sku: string | null, externalUrl: string): string {
  return sku ? `${sourceSlug}:${sku}` : `${sourceSlug}:${hash(externalUrl, 20)}`;
}

function normalizeInventoryStatus(value: string | null | undefined): InventoryStatus {
  const text = String(value ?? '').toUpperCase();
  if (text === 'LOW_STOCK') return 'LOW_STOCK';
  if (text === 'OUT_OF_STOCK') return 'OUT_OF_STOCK';
  if (text === 'DISCONTINUED') return 'DISCONTINUED';
  return 'IN_STOCK';
}

function convertToAedCents(cents: number | null | undefined, currency: string | null | undefined) {
  if (typeof cents !== 'number' || !Number.isFinite(cents) || cents <= 0) {
    return null;
  }

  const normalized = (currency ?? 'AED').toUpperCase();
  const amount = cents / 100;
  if (normalized === 'AED') return Math.round(cents);
  if (normalized === 'USD') return Math.round(amount * USD_AED * 100);
  if (normalized === 'EUR') return Math.round(amount * EUR_AED * 100);
  if (normalized === 'GBP') return Math.round(amount * GBP_AED * 100);
  return null;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function upsertOne(input: StagingProductInput) {
  const source = await prisma.supplierSource.upsert({
    where: { slug: input.sourceSlug },
    update: {
      name: input.sourceName,
      baseUrl: input.sourceBaseUrl,
      currency: input.sourceCurrency ?? input.currency ?? 'AED',
      isActive: true,
    },
    create: {
      slug: input.sourceSlug,
      name: input.sourceName,
      baseUrl: input.sourceBaseUrl,
      currency: input.sourceCurrency ?? input.currency ?? 'AED',
      isActive: true,
    },
  });

  const normalizedSku = normalizeSku(input.sku);
  const normalizedName = normalizeText(input.name);
  const sourceKey = sourceProductKey(input.sourceSlug, normalizedSku, input.externalUrl);
  const rawCurrency = input.currency ?? input.sourceCurrency ?? 'AED';
  const convertedPriceCents = convertToAedCents(input.priceCents, rawCurrency);
  const salePriceCents =
    convertedPriceCents === null ? null : Math.max(Math.round(convertedPriceCents * 1.15), 1);
  const oldPriceCents =
    salePriceCents === null ? null : Math.max(Math.round(salePriceCents / 0.9), salePriceCents);
  const warnings: string[] = [];
  const rejectReasons: string[] = [];

  if (!normalizedSku) warnings.push('missing_sku');
  if (convertedPriceCents === null) rejectReasons.push('missing_or_unsupported_price');
  if (!normalizedName) rejectReasons.push('missing_name');
  if (input.imageUrl) warnings.push('image_requires_manual_review');

  return prisma.stagingProduct.upsert({
    where: {
      sourceId_sourceProductKey: {
        sourceId: source.id,
        sourceProductKey: sourceKey,
      },
    },
    update: {
      externalUrl: input.externalUrl,
      externalSku: input.sku ?? null,
      normalizedSku,
      externalName: input.name,
      normalizedName,
      brand: input.brand ?? null,
      categoryName: input.categoryName ?? null,
      rawPriceCents: input.priceCents ?? null,
      rawCurrency,
      convertedPriceCents,
      salePriceCents,
      oldPriceCents,
      stockStatus: normalizeInventoryStatus(input.stockStatus),
      imageUrl: input.imageUrl ?? null,
      imageApproved: false,
      status: 'PENDING',
      warnings: toJson(warnings),
      rejectReasons: toJson(rejectReasons),
      rawData: toJson(input.rawData ?? input),
      normalizedData: toJson({
        pricingRule: 'salePriceCents = AED supplier price * 1.15; oldPriceCents = salePriceCents / 0.90',
      }),
      lastSeenAt: new Date(),
    },
    create: {
      sourceId: source.id,
      sourceProductKey: sourceKey,
      externalUrl: input.externalUrl,
      externalSku: input.sku ?? null,
      normalizedSku,
      externalName: input.name,
      normalizedName,
      brand: input.brand ?? null,
      categoryName: input.categoryName ?? null,
      rawPriceCents: input.priceCents ?? null,
      rawCurrency,
      convertedPriceCents,
      salePriceCents,
      oldPriceCents,
      stockStatus: normalizeInventoryStatus(input.stockStatus),
      imageUrl: input.imageUrl ?? null,
      imageApproved: false,
      status: 'PENDING',
      warnings: toJson(warnings),
      rejectReasons: toJson(rejectReasons),
      rawData: toJson(input.rawData ?? input),
      normalizedData: toJson({
        pricingRule: 'salePriceCents = AED supplier price * 1.15; oldPriceCents = salePriceCents / 0.90',
      }),
    },
  });
}

async function main() {
  const raw = await readStdin();
  const parsed = JSON.parse(raw) as StagingProductInput | StagingProductInput[];
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const result = [];

  for (const row of rows) {
    result.push(await upsertOne(row));
  }

  console.log(
    JSON.stringify({
      upserted: result.length,
      ids: result.map((row) => row.id),
      status: 'PENDING',
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
