import { getPrismaClient } from '@caracal/db';
import { Prisma, type InventoryItem, type InventoryStatus } from '@prisma/client';
import { Router, type Request, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { badRequest, notFound } from '../lib/errors.js';
import { productListQuerySchema, type ProductListQuery } from '../schemas/catalog.js';

export const productsRouter: ExpressRouter = Router();

const productInclude = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  supplier: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  images: {
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      url: true,
      altText: true,
      sortOrder: true,
      isPrimary: true,
    },
  },
  inventoryItems: {
    orderBy: [{ locationKey: 'asc' }],
    select: {
      id: true,
      locationKey: true,
      locationLabel: true,
      quantityOnHand: true,
      quantityReserved: true,
      reorderPoint: true,
      status: true,
    },
  },
} satisfies Prisma.ProductInclude;

type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

interface InventorySummary {
  status: InventoryStatus;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderPoint: number;
  locations: Array<{
    id: string;
    locationKey: string;
    locationLabel: string | null;
    quantityOnHand: number;
    quantityReserved: number;
    quantityAvailable: number;
    reorderPoint: number;
    status: InventoryStatus;
  }>;
}

function formatAed(amountCents: number | null): string | null {
  if (amountCents === null) {
    return null;
  }

  return `AED ${(amountCents / 100).toFixed(2)}`;
}

function summarizeInventory(
  items: Pick<
    InventoryItem,
    | 'id'
    | 'locationKey'
    | 'locationLabel'
    | 'quantityOnHand'
    | 'quantityReserved'
    | 'reorderPoint'
    | 'status'
  >[]
): InventorySummary {
  const locations = items.map((item) => ({
    id: item.id,
    locationKey: item.locationKey,
    locationLabel: item.locationLabel,
    quantityOnHand: item.quantityOnHand,
    quantityReserved: item.quantityReserved,
    quantityAvailable: Math.max(item.quantityOnHand - item.quantityReserved, 0),
    reorderPoint: item.reorderPoint,
    status: item.status,
  }));

  const quantityOnHand = locations.reduce((total, item) => total + item.quantityOnHand, 0);
  const quantityReserved = locations.reduce((total, item) => total + item.quantityReserved, 0);
  const quantityAvailable = locations.reduce((total, item) => total + item.quantityAvailable, 0);
  const reorderPoint = locations.reduce((total, item) => total + item.reorderPoint, 0);

  let status: InventoryStatus = 'OUT_OF_STOCK';

  if (locations.length > 0 && locations.every((item) => item.status === 'DISCONTINUED')) {
    status = 'DISCONTINUED';
  } else if (quantityAvailable <= 0) {
    status = 'OUT_OF_STOCK';
  } else if (
    quantityAvailable <= reorderPoint ||
    locations.some((item) => item.status === 'LOW_STOCK')
  ) {
    status = 'LOW_STOCK';
  } else {
    status = 'IN_STOCK';
  }

  return {
    status,
    quantityOnHand,
    quantityReserved,
    quantityAvailable,
    reorderPoint,
    locations,
  };
}

function serializeProduct(product: CatalogProduct) {
  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    description: product.description,
    status: product.status,
    category: product.category,
    supplier: product.supplier,
    price: {
      amountCents: product.priceCents,
      currency: product.currency,
      formatted: formatAed(product.priceCents),
      tradeAmountCents: product.tradePriceCents,
      tradeFormatted: formatAed(product.tradePriceCents),
    },
    flags: {
      featured: product.isFeatured,
      b2bEligible: product.isB2BEligible,
      tradeOnly: product.isTradeOnly,
    },
    inventory: summarizeInventory(product.inventoryItems),
    images: product.images,
    attributes: product.attributes,
    inquiry: {
      endpoint: '/api/product-inquiries',
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
    },
    publishedAt: product.publishedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function buildProductWhere(query: ProductListQuery): Prisma.ProductWhereInput {
  const search = query.q ?? query.search;
  const categorySlug = query.categorySlug ?? query.category;
  const where: Prisma.ProductWhereInput = {
    status: query.status,
  };
  const and: Prisma.ProductWhereInput[] = [];

  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search.toUpperCase(), mode: 'insensitive' } },
      ],
    });
  }

  if (categorySlug) {
    and.push({
      OR: [{ categoryId: categorySlug }, { category: { slug: categorySlug } }],
    });
  }

  if (query.supplier) {
    and.push({
      OR: [{ supplierId: query.supplier }, { supplier: { slug: query.supplier } }],
    });
  }

  if (query.sku) {
    and.push({ sku: query.sku });
  }

  if (query.featured !== undefined) {
    where.isFeatured = query.featured;
  }

  if (query.b2b !== undefined) {
    where.isB2BEligible = query.b2b;
  }

  if (query.tradeOnly !== undefined) {
    where.isTradeOnly = query.tradeOnly;
  }

  if (query.inStock !== undefined) {
    and.push(
      query.inStock
        ? {
            inventoryItems: {
              some: {
                status: { in: ['IN_STOCK', 'LOW_STOCK'] },
                quantityOnHand: { gt: 0 },
              },
            },
          }
        : {
            inventoryItems: {
              none: {
                status: { in: ['IN_STOCK', 'LOW_STOCK'] },
                quantityOnHand: { gt: 0 },
              },
            },
          }
    );
  }

  if (query.minPriceCents !== undefined || query.maxPriceCents !== undefined) {
    if (
      query.minPriceCents !== undefined &&
      query.maxPriceCents !== undefined &&
      query.minPriceCents > query.maxPriceCents
    ) {
      throw badRequest('minPriceCents cannot be greater than maxPriceCents.');
    }

    and.push({
      priceCents: {
        gte: query.minPriceCents,
        lte: query.maxPriceCents,
      },
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

function getProductOrderBy(
  sort: ProductListQuery['sort']
): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === 'newest') {
    return [{ createdAt: 'desc' }];
  }

  if (sort === 'name') {
    return [{ name: 'asc' }];
  }

  if (sort === 'price_asc') {
    return [{ priceCents: 'asc' }, { name: 'asc' }];
  }

  if (sort === 'price_desc') {
    return [{ priceCents: 'desc' }, { name: 'asc' }];
  }

  return [{ isFeatured: 'desc' }, { name: 'asc' }];
}

function parseProductQuery(req: Request): ProductListQuery {
  return productListQuerySchema.parse(req.query);
}

async function handleProductList(req: Request, searchMode: boolean) {
  const query = parseProductQuery(req);
  const prisma = getPrismaClient();
  const products = await prisma.product.findMany({
    where: buildProductWhere(query),
    include: productInclude,
    orderBy: getProductOrderBy(query.sort),
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = products.length > query.limit;
  const pageProducts = hasMore ? products.slice(0, query.limit) : products;
  const data = pageProducts.map(serializeProduct);

  await writeAuditLog(req, {
    action: searchMode ? 'catalog.products.searched' : 'catalog.products.listed',
    entityType: 'Product',
    metadata: {
      query,
      resultCount: data.length,
      hasMore,
    },
  });

  return {
    data,
    pagination: {
      limit: query.limit,
      hasMore,
      nextCursor: hasMore ? pageProducts[pageProducts.length - 1]?.id : null,
    },
  };
}

async function findProductBySlugOrSku(
  identifier: string,
  mode: 'slug' | 'sku'
): Promise<CatalogProduct> {
  const prisma = getPrismaClient();
  const product = await prisma.product.findUnique({
    where: mode === 'slug' ? { slug: identifier } : { sku: identifier.toUpperCase() },
    include: productInclude,
  });

  if (!product) {
    throw notFound('Product not found.', { identifier, mode });
  }

  return product;
}

productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await handleProductList(req, false);
    sendSuccess(res, result.data, 200, { pagination: result.pagination });
  })
);

productsRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const result = await handleProductList(req, true);
    sendSuccess(res, result.data, 200, { pagination: result.pagination });
  })
);

productsRouter.get(
  '/sku/:sku',
  asyncHandler(async (req, res) => {
    const product = await findProductBySlugOrSku(req.params.sku, 'sku');

    await writeAuditLog(req, {
      action: 'catalog.product.viewed',
      entityType: 'Product',
      entityId: product.id,
      metadata: {
        sku: product.sku,
        slug: product.slug,
        lookup: 'sku',
      },
    });

    sendSuccess(res, serializeProduct(product));
  })
);

productsRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const product = await findProductBySlugOrSku(req.params.slug, 'slug');

    await writeAuditLog(req, {
      action: 'catalog.product.viewed',
      entityType: 'Product',
      entityId: product.id,
      metadata: {
        sku: product.sku,
        slug: product.slug,
        lookup: 'slug',
      },
    });

    sendSuccess(res, serializeProduct(product));
  })
);
