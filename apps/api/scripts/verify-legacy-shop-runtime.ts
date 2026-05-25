import 'dotenv/config';

import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const publicRoot = path.join(projectRoot, 'apps/web/public');
const catalogPath = path.join(projectRoot, 'docs/legacy-migration/full-shop-catalog.json');
const reportPath = path.join(projectRoot, 'docs/legacy-migration/legacy-shop-runtime-report.json');
const prisma = new PrismaClient();

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  meta?: {
    pagination?: {
      limit: number;
      page?: number;
      pageSize?: number;
      total?: number;
      totalPages?: number;
      hasMore: boolean;
      nextCursor: string | null;
    };
  };
  error?: { message: string };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isLocalProductImage(url: string): boolean {
  return url.startsWith('/images/products/');
}

async function apiGet<T>(
  baseUrl: string,
  pathname: string
): Promise<{
  ok: boolean;
  status: number;
  envelope?: ApiEnvelope<T>;
  error?: string;
}> {
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      headers: { Accept: 'application/json' },
    });
    const envelope = (await response.json()) as ApiEnvelope<T>;
    return { ok: response.ok && envelope.success, status: response.status, envelope };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Unknown API error',
    };
  }
}

async function main() {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as {
    summary: { importedCandidateCount: number };
    categories: Array<{ slug: string }>;
  };

  const [totalProducts, activeProducts, totalCategories, legacyProducts, legacyCategories] =
    await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.category.count({ where: { isActive: true } }),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Product"
        WHERE metadata->>'source' = 'legacy-shop'
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Category"
        WHERE metadata->>'source' = 'legacy-shop'
      `,
    ]);

  const legacyProductCount = Number(legacyProducts[0]?.count ?? 0);
  const legacyCategoryCount = Number(legacyCategories[0]?.count ?? 0);

  const categoryCounts = await prisma.product.groupBy({
    by: ['categoryId'],
    where: { status: 'ACTIVE', categoryId: { not: null } },
    _count: { _all: true },
  });

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  const countByCategoryId = new Map(categoryCounts.map((row) => [row.categoryId, row._count._all]));

  const images = await prisma.productImage.findMany({
    where: { product: { metadata: { path: ['source'], equals: 'legacy-shop' } } },
    select: {
      id: true,
      url: true,
      product: { select: { sku: true, slug: true } },
    },
  });

  const brokenLocalImages: Array<{ sku: string; slug: string; url: string }> = [];
  let remoteImageReferences = 0;
  for (const image of images) {
    if (!isLocalProductImage(image.url)) {
      remoteImageReferences += 1;
      continue;
    }

    const diskPath = path.join(publicRoot, image.url.replace(/^\/+/, '').replace(/\//g, path.sep));
    if (!(await exists(diskPath))) {
      brokenLocalImages.push({
        sku: image.product.sku,
        slug: image.product.slug,
        url: image.url,
      });
    }
  }

  const [pageOne, pageTwo, search, categoryFilter, cursorPageOne] = await Promise.all([
    apiGet<unknown[]>(apiBaseUrl, '/api/products?limit=24&page=1'),
    apiGet<unknown[]>(apiBaseUrl, '/api/products?limit=24&page=2'),
    apiGet<unknown[]>(apiBaseUrl, '/api/products/search?q=abrites&limit=12&page=1'),
    apiGet<unknown[]>(apiBaseUrl, '/api/products?category=key-programming&limit=12&page=1'),
    apiGet<unknown[]>(apiBaseUrl, '/api/products?limit=24'),
  ]);
  const nextCursor = cursorPageOne.envelope?.meta?.pagination?.nextCursor;
  const cursorPageTwo = nextCursor
    ? await apiGet<unknown[]>(
        apiBaseUrl,
        `/api/products?limit=24&cursor=${encodeURIComponent(nextCursor)}`
      )
    : null;

  const report = {
    generatedAt: new Date().toISOString(),
    expectedLegacyProducts: catalog.summary.importedCandidateCount,
    expectedLegacyCategories: catalog.categories.length,
    database: {
      totalProducts,
      activeProducts,
      legacyProducts: legacyProductCount,
      totalActiveCategories: totalCategories,
      legacyCategories: legacyCategoryCount,
      legacyProductMatch: legacyProductCount === catalog.summary.importedCandidateCount,
      legacyCategoryMatch: legacyCategoryCount === catalog.categories.length,
      activeCategoryCounts: categories.map((category) => ({
        slug: category.slug,
        name: category.name,
        activeProducts: countByCategoryId.get(category.id) ?? 0,
      })),
    },
    images: {
      legacyImageRows: images.length,
      remoteImageReferences,
      brokenLocalImages: brokenLocalImages.length,
      sampleBrokenLocalImages: brokenLocalImages.slice(0, 10),
      localImageIntegrityPass: brokenLocalImages.length === 0,
    },
    api: {
      baseUrl: apiBaseUrl,
      pageOne: {
        ok: pageOne.ok,
        status: pageOne.status,
        items: Array.isArray(pageOne.envelope?.data) ? pageOne.envelope.data.length : 0,
        pagination: pageOne.envelope?.meta?.pagination ?? null,
        error: pageOne.error ?? pageOne.envelope?.error?.message ?? null,
      },
      pageTwo: {
        ok: pageTwo.ok,
        status: pageTwo.status,
        items: Array.isArray(pageTwo.envelope?.data) ? pageTwo.envelope.data.length : 0,
        pagination: pageTwo.envelope?.meta?.pagination ?? null,
        error: pageTwo.error ?? pageTwo.envelope?.error?.message ?? null,
      },
      search: {
        ok: search.ok,
        status: search.status,
        items: Array.isArray(search.envelope?.data) ? search.envelope.data.length : 0,
        pagination: search.envelope?.meta?.pagination ?? null,
        error: search.error ?? search.envelope?.error?.message ?? null,
      },
      categoryFilter: {
        ok: categoryFilter.ok,
        status: categoryFilter.status,
        items: Array.isArray(categoryFilter.envelope?.data)
          ? categoryFilter.envelope.data.length
          : 0,
        pagination: categoryFilter.envelope?.meta?.pagination ?? null,
        error: categoryFilter.error ?? categoryFilter.envelope?.error?.message ?? null,
      },
      cursorPagination: {
        pageOne: {
          ok: cursorPageOne.ok,
          status: cursorPageOne.status,
          items: Array.isArray(cursorPageOne.envelope?.data)
            ? cursorPageOne.envelope.data.length
            : 0,
          pagination: cursorPageOne.envelope?.meta?.pagination ?? null,
          error: cursorPageOne.error ?? cursorPageOne.envelope?.error?.message ?? null,
        },
        pageTwo: cursorPageTwo
          ? {
              ok: cursorPageTwo.ok,
              status: cursorPageTwo.status,
              items: Array.isArray(cursorPageTwo.envelope?.data)
                ? cursorPageTwo.envelope.data.length
                : 0,
              pagination: cursorPageTwo.envelope?.meta?.pagination ?? null,
              error: cursorPageTwo.error ?? cursorPageTwo.envelope?.error?.message ?? null,
            }
          : null,
      },
    },
  };

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
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
