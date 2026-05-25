import 'dotenv/config';

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Prisma, PrismaClient, type InventoryStatus } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const catalogPath = path.join(projectRoot, 'docs/legacy-migration/full-shop-catalog.json');
const importReportPath = path.join(
  projectRoot,
  'docs/legacy-migration/legacy-shop-import-report.json'
);
const publicRoot = path.join(projectRoot, 'apps/web/public');

const prisma = new PrismaClient();
const LEGACY_SUPPLIER_SLUG = 'legacy-shop-catalog';
const DEFAULT_BATCH_SIZE = 150;

interface LegacyCatalogFile {
  generatedAt: string;
  sourceWebsite: string;
  sourceRoutes: string[];
  summary: {
    oldProductCountFromLiveSidebar: number;
    importedCandidateCount: number;
    duplicateSkuCount: number;
    brokenImageCount: number;
  };
  categories: LegacyCategory[];
  products: LegacyProduct[];
}

interface LegacyCategory {
  slug: string;
  name: string;
  oldCount: number;
  extractedCount: number;
}

interface LegacyProduct {
  legacyProductId?: string;
  sku: string;
  slug: string;
  detailUrl?: string;
  name: string;
  category: string;
  categorySlug: string;
  sourceCategory?: string;
  sourceCategorySlug?: string;
  priceMinor?: number | null;
  salePriceMinor?: number | null;
  oldPriceMinor?: number | null;
  currency?: string;
  saleDiscountPercent?: number | null;
  imageUrl?: string | null;
  localImagePath?: string | null;
  description?: string | null;
  descriptionHtml?: string | null;
  specs?: unknown;
  availability?: string | null;
  stockOrCartAvailability?: {
    stockText?: string;
    availability?: string;
    cartAvailable?: boolean;
    cartAvailableFromList?: boolean;
  } | null;
  extractionWarnings?: string[];
  imageDownload?: {
    status?: string;
    localPath?: string;
    sourceUrl?: string;
    error?: string;
  } | null;
}

interface ImportOptions {
  dryRun: boolean;
  batchSize: number;
}

interface NormalizedProduct {
  sku: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  priceCents: number | null;
  oldPriceCents: number | null;
  salePriceCents: number | null;
  categorySlug: string;
  imageUrl: string | null;
  imageExists: boolean;
  inventoryStatus: InventoryStatus;
  quantityOnHand: number;
  metadata: Prisma.InputJsonObject;
  attributes: Prisma.InputJsonObject;
}

function parseOptions(): ImportOptions {
  const args = new Set(process.argv.slice(2));
  const batchArg = process.argv.find((arg) => arg.startsWith('--batch-size='));
  const batchSize = batchArg
    ? Number.parseInt(batchArg.split('=')[1] ?? '', 10)
    : DEFAULT_BATCH_SIZE;

  return {
    dryRun: args.has('--dry-run'),
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE,
  };
}

async function loadCatalog(): Promise<LegacyCatalogFile> {
  const raw = await readFile(catalogPath, 'utf8');
  return JSON.parse(raw) as LegacyCatalogFile;
}

function compactText(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

function shortDescription(description: string | null | undefined): string | null {
  const text = compactText(description);
  if (!text) {
    return null;
  }

  return text.length > 240 ? `${text.slice(0, 237).trimEnd()}...` : text;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function toCents(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Math.round(Number(value)) : null;
}

function localImageExists(localImagePath: string | null | undefined): boolean {
  if (!localImagePath) {
    return false;
  }

  const relativePath = localImagePath.replace(/^\/+/, '').replace(/\//g, path.sep);
  return existsSync(path.join(publicRoot, relativePath));
}

function mapInventory(product: LegacyProduct): {
  status: InventoryStatus;
  quantityOnHand: number;
} {
  const stock = product.stockOrCartAvailability;
  const text =
    `${stock?.stockText ?? ''} ${stock?.availability ?? ''} ${product.availability ?? ''}`
      .toLowerCase()
      .trim();

  if (/discontinued/.test(text)) {
    return { status: 'DISCONTINUED', quantityOnHand: 0 };
  }

  if (/out of stock|sold out|temporarily unavailable|unavailable/.test(text)) {
    return { status: 'OUT_OF_STOCK', quantityOnHand: 0 };
  }

  return { status: 'IN_STOCK', quantityOnHand: 1 };
}

function normalizeProduct(product: LegacyProduct): NormalizedProduct {
  const inventory = mapInventory(product);
  const imageExists = localImageExists(product.localImagePath);
  const activeImageUrl = imageExists ? (product.localImagePath ?? null) : null;
  const salePriceCents = toCents(product.salePriceMinor);
  const priceCents = salePriceCents ?? toCents(product.priceMinor);
  const oldPriceCents = toCents(product.oldPriceMinor);

  return {
    sku: product.sku.trim(),
    slug: product.slug.trim(),
    name: product.name.trim(),
    shortDescription: shortDescription(product.description),
    description: compactText(product.description),
    priceCents,
    oldPriceCents,
    salePriceCents,
    categorySlug: product.categorySlug,
    imageUrl: activeImageUrl,
    imageExists,
    inventoryStatus: inventory.status,
    quantityOnHand: inventory.quantityOnHand,
    attributes: {
      legacyProductId: product.legacyProductId ?? null,
      legacyCategory: product.category,
      legacyCategorySlug: product.categorySlug,
      sourceCategory: product.sourceCategory ?? product.category,
      sourceCategorySlug: product.sourceCategorySlug ?? product.categorySlug,
      salePriceCents,
      oldPriceCents,
      saleDiscountPercent: product.saleDiscountPercent ?? null,
      specs: jsonValue(product.specs),
      inquiryReady: true,
    },
    metadata: {
      source: 'legacy-shop',
      migratedAt: new Date().toISOString(),
      detailUrl: product.detailUrl ?? null,
      sourceImageUrl: product.imageUrl ?? null,
      localImagePath: product.localImagePath ?? null,
      imageStatus: product.imageDownload?.status ?? (imageExists ? 'downloaded' : 'missing'),
      imageError: product.imageDownload?.error ?? null,
      descriptionHtml: product.descriptionHtml ?? null,
      availability: product.availability ?? null,
      stockOrCartAvailability: jsonValue(product.stockOrCartAvailability),
      extractionWarnings: jsonValue(product.extractionWarnings ?? []),
    },
  };
}

function uniqueProducts(products: NormalizedProduct[]): NormalizedProduct[] {
  const seen = new Set<string>();
  const result: NormalizedProduct[] = [];

  for (const product of products) {
    if (!product.sku || seen.has(product.sku)) {
      continue;
    }

    seen.add(product.sku);
    result.push(product);
  }

  return result;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function upsertSupplier() {
  return prisma.supplier.upsert({
    where: { slug: LEGACY_SUPPLIER_SLUG },
    update: {
      name: 'Legacy Shop Catalog',
      websiteUrl: 'https://caracaltechmotors.com',
      notes: 'Imported from the May 2026 legacy shop migration dataset.',
      metadata: { source: 'legacy-shop' },
    },
    create: {
      name: 'Legacy Shop Catalog',
      slug: LEGACY_SUPPLIER_SLUG,
      websiteUrl: 'https://caracaltechmotors.com',
      notes: 'Imported from the May 2026 legacy shop migration dataset.',
      metadata: { source: 'legacy-shop' },
    },
    select: { id: true },
  });
}

async function upsertCategories(categories: LegacyCategory[], batchSize: number) {
  const sorted = categories.map((category, index) => ({
    ...category,
    sortOrder: (index + 1) * 10,
  }));

  for (const batch of chunk(sorted, batchSize)) {
    await prisma.$transaction(
      batch.map((category) =>
        prisma.category.upsert({
          where: { slug: category.slug },
          update: {
            name: category.name,
            description: `Legacy shop category imported from caracaltechmotors.com (${category.oldCount} products).`,
            parentId: null,
            sortOrder: category.sortOrder,
            isActive: true,
            metadata: {
              source: 'legacy-shop',
              oldProductCount: category.oldCount,
              extractedProductCount: category.extractedCount,
            },
          },
          create: {
            name: category.name,
            slug: category.slug,
            description: `Legacy shop category imported from caracaltechmotors.com (${category.oldCount} products).`,
            parentId: null,
            sortOrder: category.sortOrder,
            isActive: true,
            metadata: {
              source: 'legacy-shop',
              oldProductCount: category.oldCount,
              extractedProductCount: category.extractedCount,
            },
          },
          select: { id: true },
        })
      )
    );
  }

  const categoryRows = await prisma.category.findMany({
    where: { slug: { in: categories.map((category) => category.slug) } },
    select: { id: true, slug: true },
  });

  return new Map(categoryRows.map((category) => [category.slug, category.id]));
}

async function upsertProducts(
  products: NormalizedProduct[],
  categoryBySlug: Map<string, string>,
  supplierId: string,
  batchSize: number
) {
  let processed = 0;

  for (const batch of chunk(products, batchSize)) {
    await prisma.$transaction(
      batch.map((product) => {
        const categoryId = categoryBySlug.get(product.categorySlug);
        if (!categoryId) {
          throw new Error(`Missing category ${product.categorySlug} for ${product.sku}`);
        }

        return prisma.product.upsert({
          where: { sku: product.sku },
          update: {
            slug: product.slug,
            name: product.name,
            shortDescription: product.shortDescription,
            description: product.description,
            status: 'ACTIVE',
            priceCents: product.priceCents,
            currency: 'AED',
            tradePriceCents: null,
            isFeatured: false,
            isB2BEligible: true,
            isTradeOnly: false,
            categoryId,
            supplierId,
            attributes: product.attributes,
            metadata: product.metadata,
            publishedAt: new Date(),
          },
          create: {
            sku: product.sku,
            slug: product.slug,
            name: product.name,
            shortDescription: product.shortDescription,
            description: product.description,
            status: 'ACTIVE',
            priceCents: product.priceCents,
            currency: 'AED',
            tradePriceCents: null,
            isFeatured: false,
            isB2BEligible: true,
            isTradeOnly: false,
            categoryId,
            supplierId,
            attributes: product.attributes,
            metadata: product.metadata,
            publishedAt: new Date(),
          },
          select: { id: true },
        });
      })
    );

    processed += batch.length;
    if (processed % 1500 === 0 || processed === products.length) {
      console.log(`Upserted ${processed}/${products.length} products`);
    }
  }
}

async function refreshProductImages(products: NormalizedProduct[], batchSize: number) {
  const importedSkus = products.map((product) => product.sku);
  const productRows = await prisma.product.findMany({
    where: { sku: { in: importedSkus } },
    select: { id: true, sku: true, name: true },
  });
  const productBySku = new Map(productRows.map((product) => [product.sku, product]));
  const productIds = productRows.map((product) => product.id);

  for (const idBatch of chunk(productIds, 1000)) {
    await prisma.productImage.deleteMany({ where: { productId: { in: idBatch } } });
  }

  const imageRows: Prisma.ProductImageCreateManyInput[] = [];
  for (const product of products) {
    if (!product.imageUrl) {
      continue;
    }

    const record = productBySku.get(product.sku);
    if (!record) {
      continue;
    }

    imageRows.push({
      productId: record.id,
      url: product.imageUrl,
      altText: product.name,
      sortOrder: 0,
      isPrimary: true,
      metadata: {
        source: 'legacy-shop',
        localFileVerified: product.imageExists,
      },
    });
  }

  for (const imageBatch of chunk(imageRows, 1000)) {
    await prisma.productImage.createMany({
      data: imageBatch,
      skipDuplicates: true,
    });
  }

  return { productRows, imageRows };
}

async function upsertInventory(
  products: NormalizedProduct[],
  productRows: Array<{ id: string; sku: string }>,
  batchSize: number
) {
  const productBySku = new Map(productRows.map((product) => [product.sku, product.id]));

  for (const batch of chunk(products, batchSize)) {
    await prisma.$transaction(
      batch.map((product) => {
        const productId = productBySku.get(product.sku);
        if (!productId) {
          throw new Error(`Missing product ID for ${product.sku}`);
        }

        return prisma.inventoryItem.upsert({
          where: {
            productId_locationKey: {
              productId,
              locationKey: 'legacy-shop',
            },
          },
          update: {
            locationLabel: 'Legacy Shop Availability',
            quantityOnHand: product.quantityOnHand,
            quantityReserved: 0,
            reorderPoint: 0,
            status: product.inventoryStatus,
            metadata: { source: 'legacy-shop' },
          },
          create: {
            productId,
            locationKey: 'legacy-shop',
            locationLabel: 'Legacy Shop Availability',
            quantityOnHand: product.quantityOnHand,
            quantityReserved: 0,
            reorderPoint: 0,
            status: product.inventoryStatus,
            metadata: { source: 'legacy-shop' },
          },
        });
      })
    );
  }
}

async function main() {
  const options = parseOptions();
  const catalog = await loadCatalog();
  const normalizedProducts = uniqueProducts(catalog.products.map(normalizeProduct));
  const missingImages = normalizedProducts.filter((product) => !product.imageUrl).length;

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          catalogProducts: catalog.products.length,
          normalizedProducts: normalizedProducts.length,
          categories: catalog.categories.length,
          productsWithoutLocalImage: missingImages,
        },
        null,
        2
      )
    );
    return;
  }

  const supplier = await upsertSupplier();
  const categoryBySlug = await upsertCategories(catalog.categories, options.batchSize);
  await upsertProducts(normalizedProducts, categoryBySlug, supplier.id, options.batchSize);
  const { productRows, imageRows } = await refreshProductImages(
    normalizedProducts,
    options.batchSize
  );
  await upsertInventory(normalizedProducts, productRows, options.batchSize);

  const [totalProducts, legacyProducts, totalCategories, legacyImages, inventoryItems] =
    await Promise.all([
      prisma.product.count(),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Product"
        WHERE metadata->>'source' = 'legacy-shop'
      `,
      prisma.category.count({ where: { isActive: true } }),
      prisma.productImage.count({ where: { productId: { in: productRows.map((row) => row.id) } } }),
      prisma.inventoryItem.count({
        where: {
          productId: { in: productRows.map((row) => row.id) },
          locationKey: 'legacy-shop',
        },
      }),
    ]);

  const report = {
    importedAt: new Date().toISOString(),
    sourceCatalog: path.relative(projectRoot, catalogPath).replace(/\\/g, '/'),
    sourceGeneratedAt: catalog.generatedAt,
    sourceWebsite: catalog.sourceWebsite,
    expectedLegacyProducts: catalog.summary.importedCandidateCount,
    normalizedProducts: normalizedProducts.length,
    categoriesImported: catalog.categories.length,
    totalActiveCategories: totalCategories,
    totalProducts,
    legacyProducts: Number(legacyProducts[0]?.count ?? 0),
    legacyProductImages: legacyImages,
    legacyInventoryItems: inventoryItems,
    productsWithoutLocalImage: missingImages,
    sourceBrokenImageCount: catalog.summary.brokenImageCount,
  };

  await writeFile(importReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
