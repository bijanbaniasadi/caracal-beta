import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function publicUrlToPath(publicRoot: string, url: string): string | null {
  if (!url.startsWith('/') || /^\/\//.test(url)) {
    return null;
  }

  return path.join(publicRoot, ...url.split('/').filter(Boolean));
}

async function main(): Promise<void> {
  const publicRoot = path.resolve(process.cwd(), '..', 'web', 'public');
  const migratedAssetRoot = path.join(publicRoot, 'images', 'products', 'legacy-commercial');
  const migratedAssets = walkFiles(migratedAssetRoot);
  const migratedAssetUrls = migratedAssets.map((assetPath) => {
    const relativePath = path.relative(publicRoot, assetPath).split(path.sep).join('/');
    return `/${relativePath}`;
  });

  const products = await prisma.product.findMany({
    orderBy: { sku: 'asc' },
    include: {
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  const productRows = products.map((product) => {
    const urls = product.images.map((image) => image.url);
    const localMissing = urls.filter((url) => {
      const localPath = publicUrlToPath(publicRoot, url);
      return localPath ? !fs.existsSync(localPath) : false;
    });
    const catalogReferences = urls.filter((url) => url.includes('/catalog'));
    const hasWorkingImage =
      urls.length > 0 && localMissing.length === 0 && catalogReferences.length === 0;
    const seeded =
      !!product.metadata && typeof product.metadata === 'object' && 'seeded' in product.metadata;

    return {
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      status: product.status,
      seeded,
      imageUrls: urls,
      hasWorkingImage,
      localMissing,
      catalogReferences,
    };
  });

  const referencedUrls = new Set(productRows.flatMap((product) => product.imageUrls));
  const seededProducts = productRows.filter((product) => product.seeded);
  const summary = {
    totalProducts: productRows.length,
    seededCommercialProducts: seededProducts.length,
    productsWithWorkingImages: productRows.filter((product) => product.hasWorkingImage).length,
    seededCommercialProductsWithWorkingImages: seededProducts.filter(
      (product) => product.hasWorkingImage
    ).length,
    remainingMissingImages: productRows
      .filter((product) => product.imageUrls.length === 0)
      .map((product) => ({ sku: product.sku, slug: product.slug, status: product.status })),
    remainingMissingCommercialImages: seededProducts
      .filter((product) => product.imageUrls.length === 0)
      .map((product) => ({ sku: product.sku, slug: product.slug, status: product.status })),
    brokenImageUrls: productRows
      .filter((product) => product.localMissing.length > 0)
      .map((product) => ({
        sku: product.sku,
        slug: product.slug,
        missingUrls: product.localMissing,
      })),
    catalogImageReferences: productRows
      .filter((product) => product.catalogReferences.length > 0)
      .map((product) => ({
        sku: product.sku,
        slug: product.slug,
        urls: product.catalogReferences,
      })),
    migratedAssetCount: migratedAssetUrls.length,
    orphanedMigratedAssets: migratedAssetUrls.filter((url) => !referencedUrls.has(url)),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (
    summary.remainingMissingCommercialImages.length > 0 ||
    summary.brokenImageUrls.length > 0 ||
    summary.catalogImageReferences.length > 0
  ) {
    process.exitCode = 1;
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
