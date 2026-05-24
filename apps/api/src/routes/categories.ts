import { getPrismaClient } from '@caracal/db';
import { Prisma } from '@prisma/client';
import { Router, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { notFound } from '../lib/errors.js';
import { categoryListQuerySchema } from '../schemas/catalog.js';

export const categoriesRouter: ExpressRouter = Router();

const categoryInclude = {
  parent: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  children: {
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      isActive: true,
    },
  },
  _count: {
    select: {
      children: true,
      products: true,
    },
  },
} satisfies Prisma.CategoryInclude;

type CatalogCategory = Prisma.CategoryGetPayload<{ include: typeof categoryInclude }>;

function serializeCategory(category: CatalogCategory) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    parent: category.parent,
    children: category.children,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    metadata: category.metadata,
    counts: {
      children: category._count.children,
      products: category._count.products,
    },
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

categoriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = categoryListQuerySchema.parse(req.query);
    const prisma = getPrismaClient();
    const categories = await prisma.category.findMany({
      where: query.includeInactive ? undefined : { isActive: true },
      include: categoryInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const data = categories.map(serializeCategory);

    await writeAuditLog(req, {
      action: 'catalog.categories.listed',
      entityType: 'Category',
      metadata: {
        includeInactive: query.includeInactive,
        resultCount: data.length,
      },
    });

    sendSuccess(res, data);
  })
);

categoriesRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const category = await prisma.category.findUnique({
      where: { slug: req.params.slug },
      include: categoryInclude,
    });

    if (!category) {
      throw notFound('Category not found.', { slug: req.params.slug });
    }

    await writeAuditLog(req, {
      action: 'catalog.category.viewed',
      entityType: 'Category',
      entityId: category.id,
      metadata: {
        slug: category.slug,
      },
    });

    sendSuccess(res, serializeCategory(category));
  })
);
