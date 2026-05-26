import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getPrismaClient } from '@caracal/db';
import {
  Prisma,
  type IntakeStatus,
  type InventoryItem,
  type InventoryStatus,
  type ProductStatus,
  type WorkerHeartbeat,
} from '@prisma/client';
import { Router, type Request, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import {
  cleanBinAnalysisQueue,
  recoverStalledAnalysisJobs,
} from '../lib/bin-analysis/maintenance.js';
import {
  binAnalysisQueueName,
  createBinAnalysisQueue,
  enqueueBinAnalysisJob,
  getBinAnalysisQueue,
  retryBinAnalysisJob,
} from '../lib/bin-analysis/queue.js';
import { getCatalogQueues } from '../lib/catalog/queues.js';
import {
  ecuCorpusStages,
  getEcuCorpusQueue,
  getEcuCorpusQueueStats,
} from '../lib/ecu-corpus/queues.js';
import { badRequest, notFound } from '../lib/errors.js';
import { orderInclude, releaseOrderReservations, serializeOrder } from '../lib/payments/orders.js';
import { getStripeClient, paymentLogger } from '../lib/payments/stripe.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { authenticateAccessToken, requireRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { adminCatalogSyncRouter } from './admin-catalog-sync.js';
import { adminEcuPatcherRouter } from './admin-ecu-patcher.js';
import { adminMasterCatalogRouter } from './admin-master-catalog.js';
import { adminReviewQueueRouter } from './admin-review-queue.js';
import { ecuCorpusRouter } from './ecu-corpus.js';
import {
  adminListQuerySchema,
  articleCreateSchema,
  articleUpdateSchema,
  binAnalysisEnqueueSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  inquiryUpdateSchema,
  inventoryUpdateSchema,
  inventoryUpsertSchema,
  orderRefundSchema,
  orderUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
  uploadUpdateSchema,
  type AdminListQuery,
  type ArticleCreateInput,
  type ArticleUpdateInput,
  type BinAnalysisEnqueueInput,
  type CategoryCreateInput,
  type CategoryUpdateInput,
  type InquiryUpdateInput,
  type InventoryUpdateInput,
  type InventoryUpsertInput,
  type OrderRefundInput,
  type OrderUpdateInput,
  type ProductCreateInput,
  type ProductUpdateInput,
  type UploadUpdateInput,
} from '../schemas/admin.js';

export const adminRouter: ExpressRouter = Router();
const queueBoardAdapter = new ExpressAdapter();

queueBoardAdapter.setBasePath('/api/admin/queues/ui');
createBullBoard({
  queues: [
    new BullMQAdapter(getBinAnalysisQueue()),
    ...ecuCorpusStages.map((stage) => new BullMQAdapter(getEcuCorpusQueue(stage))),
    ...getCatalogQueues().map((queue) => new BullMQAdapter(queue)),
  ],
  serverAdapter: queueBoardAdapter,
});

adminRouter.use(authenticateAccessToken, requireRoles('admin', 'staff'));
adminRouter.use('/queues/ui', queueBoardAdapter.getRouter());
adminRouter.use('/catalog/sync', adminCatalogSyncRouter);
adminRouter.use('/master-products', adminMasterCatalogRouter);
adminRouter.use('/review-queue', adminReviewQueueRouter);
adminRouter.use('/ecu-patcher', adminEcuPatcherRouter);
adminRouter.use('/ecu-corpus', ecuCorpusRouter);

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
  },
  inventoryItems: {
    orderBy: [{ locationKey: 'asc' }],
  },
  _count: {
    select: {
      cartItems: true,
      inquiries: true,
    },
  },
} satisfies Prisma.ProductInclude;

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
      isActive: true,
      sortOrder: true,
    },
  },
  _count: {
    select: {
      children: true,
      products: true,
    },
  },
} satisfies Prisma.CategoryInclude;

type AdminProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function parseListQuery(req: Request): AdminListQuery {
  return adminListQuerySchema.parse(req.query);
}

function paginationMeta<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;

  return {
    pageItems,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore ? pageItems[pageItems.length - 1]?.id : null,
    },
  };
}

function inventorySummary(items: InventoryItem[]) {
  const quantityOnHand = items.reduce((total, item) => total + item.quantityOnHand, 0);
  const quantityReserved = items.reduce((total, item) => total + item.quantityReserved, 0);
  const quantityAvailable = Math.max(quantityOnHand - quantityReserved, 0);
  const reorderPoint = items.reduce((total, item) => total + item.reorderPoint, 0);
  let status: InventoryStatus = 'OUT_OF_STOCK';

  if (items.length > 0 && items.every((item) => item.status === 'DISCONTINUED')) {
    status = 'DISCONTINUED';
  } else if (quantityAvailable <= 0) {
    status = 'OUT_OF_STOCK';
  } else if (
    quantityAvailable <= reorderPoint ||
    items.some((item) => item.status === 'LOW_STOCK')
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
  };
}

function serializeProduct(product: AdminProduct) {
  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    description: product.description,
    status: product.status,
    priceCents: product.priceCents,
    currency: product.currency,
    category: product.category,
    supplier: product.supplier,
    isFeatured: product.isFeatured,
    isB2BEligible: product.isB2BEligible,
    isTradeOnly: product.isTradeOnly,
    tradePriceCents: product.tradePriceCents,
    attributes: product.attributes,
    metadata: product.metadata,
    images: product.images,
    inventory: {
      summary: inventorySummary(product.inventoryItems),
      items: product.inventoryItems,
    },
    counts: {
      cartItems: product._count.cartItems,
      inquiries: product._count.inquiries,
    },
    publishedAt: product.publishedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function productWhere(query: AdminListQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  const and: Prisma.ProductWhereInput[] = [];

  if (query.status) {
    where.status = query.status as ProductStatus;
  }

  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: 'insensitive' } },
        { sku: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q, mode: 'insensitive' } },
      ],
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

function orderWhere(query: AdminListQuery): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  const and: Prisma.OrderWhereInput[] = [];

  if (query.status) {
    where.status = query.status as Prisma.OrderWhereInput['status'];
  }
  if (query.paymentStatus) {
    where.paymentStatus = query.paymentStatus as Prisma.OrderWhereInput['paymentStatus'];
  }
  if (query.fulfillmentStatus) {
    where.fulfillmentStatus =
      query.fulfillmentStatus as Prisma.OrderWhereInput['fulfillmentStatus'];
  }
  if (query.refundStatus) {
    where.refundStatus = query.refundStatus as Prisma.OrderWhereInput['refundStatus'];
  }

  if (query.q) {
    and.push({
      OR: [
        { orderNumber: { contains: query.q, mode: 'insensitive' } },
        { customerEmail: { contains: query.q, mode: 'insensitive' } },
        { customerName: { contains: query.q, mode: 'insensitive' } },
        { stripeCheckoutSessionId: { contains: query.q, mode: 'insensitive' } },
        { stripePaymentIntentId: { contains: query.q, mode: 'insensitive' } },
        {
          items: {
            some: {
              OR: [
                { sku: { contains: query.q, mode: 'insensitive' } },
                { name: { contains: query.q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

function imageCreates(input: ProductCreateInput['images'] | ProductUpdateInput['images']) {
  return input?.map((image) => ({
    url: image.url,
    altText: image.altText,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
    metadata: toPrismaJson(image.metadata),
  }));
}

function inventoryCreates(
  input: ProductCreateInput['inventoryItems'] | ProductUpdateInput['inventoryItems']
) {
  return input?.map((item) => ({
    locationKey: item.locationKey,
    locationLabel: item.locationLabel,
    quantityOnHand: item.quantityOnHand,
    quantityReserved: item.quantityReserved,
    reorderPoint: item.reorderPoint,
    status: item.status,
    metadata: toPrismaJson(item.metadata),
  }));
}

function productCreateData(input: ProductCreateInput): Prisma.ProductCreateInput {
  return {
    sku: input.sku,
    slug: input.slug,
    name: input.name,
    shortDescription: input.shortDescription,
    description: input.description,
    status: input.status,
    priceCents: input.priceCents,
    currency: input.currency,
    category: input.categoryId ? { connect: { id: input.categoryId } } : undefined,
    supplier: input.supplierId ? { connect: { id: input.supplierId } } : undefined,
    isFeatured: input.isFeatured,
    isB2BEligible: input.isB2BEligible,
    isTradeOnly: input.isTradeOnly,
    tradePriceCents: input.tradePriceCents,
    attributes: toPrismaJson(input.attributes),
    metadata: toPrismaJson(input.metadata),
    publishedAt: input.publishedAt,
  };
}

function productUpdateData(input: ProductUpdateInput): Prisma.ProductUpdateInput {
  return {
    sku: input.sku,
    slug: input.slug,
    name: input.name,
    shortDescription: input.shortDescription,
    description: input.description,
    status: input.status,
    priceCents: input.priceCents,
    currency: input.currency,
    category:
      input.categoryId === null
        ? { disconnect: true }
        : input.categoryId
          ? { connect: { id: input.categoryId } }
          : undefined,
    supplier:
      input.supplierId === null
        ? { disconnect: true }
        : input.supplierId
          ? { connect: { id: input.supplierId } }
          : undefined,
    isFeatured: input.isFeatured,
    isB2BEligible: input.isB2BEligible,
    isTradeOnly: input.isTradeOnly,
    tradePriceCents: input.tradePriceCents,
    attributes: toPrismaJson(input.attributes),
    metadata: toPrismaJson(input.metadata),
    publishedAt: input.publishedAt,
  };
}

function articleCreateData(input: ArticleCreateInput): Prisma.ArticleCreateInput {
  return {
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    contentHtml: input.contentHtml,
    status: input.status,
    category: input.category,
    coverImage: input.coverImage,
    thumbnailImage: input.thumbnailImage,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    keywords: input.keywords,
    isFeatured: input.isFeatured,
    author: input.authorId ? { connect: { id: input.authorId } } : undefined,
    metadata: toPrismaJson(input.metadata),
    publishedAt: input.publishedAt,
  };
}

function articleUpdateData(input: ArticleUpdateInput): Prisma.ArticleUpdateInput {
  return {
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    contentHtml: input.contentHtml,
    status: input.status,
    category: input.category,
    coverImage: input.coverImage,
    thumbnailImage: input.thumbnailImage,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    keywords: input.keywords,
    isFeatured: input.isFeatured,
    author:
      input.authorId === null
        ? { disconnect: true }
        : input.authorId
          ? { connect: { id: input.authorId } }
          : undefined,
    metadata: toPrismaJson(input.metadata),
    publishedAt: input.publishedAt,
  };
}

function groupCounts<T extends string>(
  rows: Array<{ status: T; _count?: true | { _all?: number } }>
): Record<T, number> {
  return Object.fromEntries(
    rows.map((row) => [row.status, typeof row._count === 'object' ? (row._count._all ?? 0) : 0])
  ) as Record<T, number>;
}

async function readBinAnalysisQueueStats() {
  const queue = createBinAnalysisQueue();

  try {
    const [counts, isPaused] = await Promise.all([
      queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused',
        'prioritized',
        'waiting-children'
      ),
      queue.isPaused(),
    ]);

    return {
      queueName: binAnalysisQueueName,
      isPaused,
      counts,
      settings: {
        concurrency: Number.parseInt(process.env.BIN_ANALYSIS_WORKER_CONCURRENCY ?? '2', 10),
        maxAttempts: Number.parseInt(process.env.BIN_ANALYSIS_MAX_ATTEMPTS ?? '3', 10),
        retryBackoffMs: Number.parseInt(process.env.BIN_ANALYSIS_RETRY_BACKOFF_MS ?? '30000', 10),
        stalledAfterMs: Number.parseInt(process.env.BIN_ANALYSIS_STALLED_AFTER_MS ?? '300000', 10),
      },
    };
  } finally {
    await queue.close();
  }
}

function serializeWorkerHeartbeat(worker: WorkerHeartbeat, staleAfterMs: number, now = new Date()) {
  const isStale =
    worker.status === 'ONLINE' && now.getTime() - worker.lastSeenAt.getTime() > staleAfterMs;

  return {
    ...worker,
    isStale,
    effectiveStatus: isStale ? 'STALE' : worker.status,
  };
}

adminRouter.get(
  '/dashboard/metrics',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const [
      users,
      productCounts,
      articleCounts,
      quoteCounts,
      productInquiryCounts,
      workshopCounts,
      orderCounts,
      paymentCounts,
      fulfillmentCounts,
      uploadCounts,
      inventoryCounts,
      binAnalysisCounts,
      recentAuditLogs,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.product.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.article.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.quoteRequest.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.productInquiry.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.workshopConsultationLead.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ['paymentStatus'],
        orderBy: { paymentStatus: 'asc' },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ['fulfillmentStatus'],
        orderBy: { fulfillmentStatus: 'asc' },
        _count: { _all: true },
      }),
      prisma.binUpload.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.inventoryItem.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.binAnalysisJob.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          actorType: true,
          actorId: true,
          action: true,
          entityType: true,
          entityId: true,
          requestId: true,
          createdAt: true,
        },
      }),
    ]);

    await writeAuditLog(req, {
      action: 'admin.dashboard.metrics.viewed',
      entityType: 'Dashboard',
    });

    sendSuccess(res, {
      users,
      products: groupCounts(productCounts),
      articles: groupCounts(articleCounts),
      inquiries: {
        quoteRequests: groupCounts(quoteCounts),
        productInquiries: groupCounts(productInquiryCounts),
        workshopConsultations: groupCounts(workshopCounts),
      },
      orders: {
        byStatus: groupCounts(orderCounts),
        byPaymentStatus: Object.fromEntries(
          paymentCounts.map((row) => [
            row.paymentStatus,
            typeof row._count === 'object' ? (row._count._all ?? 0) : 0,
          ])
        ),
        byFulfillmentStatus: Object.fromEntries(
          fulfillmentCounts.map((row) => [
            row.fulfillmentStatus,
            typeof row._count === 'object' ? (row._count._all ?? 0) : 0,
          ])
        ),
      },
      uploads: groupCounts(uploadCounts),
      inventory: groupCounts(inventoryCounts),
      binAnalysis: groupCounts(binAnalysisCounts),
      recentAuditLogs,
    });
  })
);

adminRouter.get(
  '/queues/bin-analysis',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await readBinAnalysisQueueStats());
  })
);

adminRouter.get(
  '/queues/ecu-corpus',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await getEcuCorpusQueueStats());
  })
);

adminRouter.get(
  '/queues/health',
  asyncHandler(async (_req, res) => {
    const prisma = getPrismaClient();
    const staleAfterMs = Number.parseInt(
      process.env.WORKER_HEARTBEAT_STALE_AFTER_MS ?? '60000',
      10
    );
    const [queue, ecuCorpusQueues, heartbeats] = await Promise.all([
      readBinAnalysisQueueStats(),
      getEcuCorpusQueueStats(),
      prisma.workerHeartbeat.findMany({
        where: { queueName: binAnalysisQueueName },
        orderBy: { lastSeenAt: 'desc' },
        take: 20,
      }),
    ]);

    sendSuccess(res, {
      queue,
      ecuCorpusQueues,
      workers: heartbeats.map((worker) => serializeWorkerHeartbeat(worker, staleAfterMs)),
      heartbeat: {
        staleAfterMs,
      },
    });
  })
);

adminRouter.post(
  '/queues/bin-analysis/cleanup',
  asyncHandler(async (req, res) => {
    const queue = createBinAnalysisQueue();

    try {
      const [cleanup, recovery] = await Promise.all([
        cleanBinAnalysisQueue(queue),
        recoverStalledAnalysisJobs(),
      ]);

      await writeAuditLog(req, {
        action: 'admin.queue.cleanup',
        entityType: 'Queue',
        entityId: binAnalysisQueueName,
        metadata: {
          cleanup,
          recovery,
        },
      });

      sendSuccess(res, {
        queueName: binAnalysisQueueName,
        cleanup,
        recovery,
      });
    } finally {
      await queue.close();
    }
  })
);

adminRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req);
    const prisma = getPrismaClient();
    const rows = await prisma.order.findMany({
      where: orderWhere(query),
      include: orderInclude,
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const { pageItems, pagination } = paginationMeta(rows, query.limit);

    sendSuccess(res, pageItems.map(serializeOrder), 200, { pagination });
  })
);

adminRouter.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: orderInclude,
    });

    if (!order) {
      throw notFound('Order not found.', { id: req.params.id });
    }

    sendSuccess(res, serializeOrder(order));
  })
);

adminRouter.patch(
  '/orders/:id',
  validateBody(orderUpdateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as OrderUpdateInput;
    const prisma = getPrismaClient();
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: input.status,
        paymentStatus: input.paymentStatus,
        fulfillmentStatus: input.fulfillmentStatus,
        refundStatus: input.refundStatus,
        shippingTracking: input.shippingTracking,
        adminNotes: input.adminNotes,
        metadata: input.metadata ? toPrismaJson(input.metadata) : undefined,
      },
      include: orderInclude,
    });

    await writeAuditLog(req, {
      action: 'admin.order.updated',
      entityType: 'Order',
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        refundStatus: order.refundStatus,
      },
    });

    sendSuccess(res, serializeOrder(order));
  })
);

adminRouter.post(
  '/orders/:id/cancel',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: orderInclude,
    });

    if (!order) {
      throw notFound('Order not found.', { id: req.params.id });
    }

    if (order.paymentStatus === 'PAID') {
      throw badRequest('Paid orders must be refunded instead of cancelled.', {
        id: order.id,
        orderNumber: order.orderNumber,
      });
    }

    if (order.stripeCheckoutSessionId && process.env.STRIPE_SECRET_KEY) {
      try {
        await getStripeClient().checkout.sessions.expire(order.stripeCheckoutSessionId);
      } catch (error) {
        paymentLogger.warn(
          { err: error, orderId: order.id, sessionId: order.stripeCheckoutSessionId },
          'stripe checkout session expire failed during admin cancel'
        );
      }
    }

    const cancelled = await prisma.$transaction(async (tx) => {
      await releaseOrderReservations(tx, order.id);
      await tx.orderPayment.updateMany({
        where: { orderId: order.id, provider: 'STRIPE' },
        data: {
          status: 'CANCELLED',
          failedAt: new Date(),
          failureMessage: 'Cancelled by admin',
        },
      });

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'CANCELLED',
          fulfillmentStatus: 'CANCELLED',
          cancelledAt: new Date(),
        },
        include: orderInclude,
      });
    });

    await writeAuditLog(req, {
      action: 'admin.order.cancelled',
      entityType: 'Order',
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        stripeCheckoutSessionId: order.stripeCheckoutSessionId,
      },
    });

    sendSuccess(res, serializeOrder(cancelled));
  })
);

adminRouter.post(
  '/orders/:id/refund',
  validateBody(orderRefundSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as OrderRefundInput;
    const prisma = getPrismaClient();
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: orderInclude,
    });

    if (!order) {
      throw notFound('Order not found.', { id: req.params.id });
    }

    if (order.paymentStatus !== 'PAID' && order.paymentStatus !== 'PARTIALLY_REFUNDED') {
      throw badRequest('Only paid orders can be refunded.', {
        id: order.id,
        paymentStatus: order.paymentStatus,
      });
    }

    const paymentIntent = order.stripePaymentIntentId ?? order.payments[0]?.stripePaymentIntentId;
    if (!paymentIntent) {
      throw badRequest('Order does not have a Stripe payment intent to refund.', {
        id: order.id,
      });
    }

    const refundAmount = input.amountCents ?? order.totalCents;
    if (refundAmount > order.totalCents) {
      throw badRequest('Refund amount cannot exceed order total.', {
        refundAmount,
        totalCents: order.totalCents,
      });
    }

    const refund = await getStripeClient().refunds.create({
      payment_intent: paymentIntent,
      amount: refundAmount,
      reason: input.reason,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        actorId: req.auth?.userId ?? '',
      },
    });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderPayment.updateMany({
        where: { orderId: order.id, provider: 'STRIPE' },
        data: {
          status: 'REFUND_PENDING',
          stripeRefundId: refund.id,
        },
      });

      return tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'REFUND_PENDING',
          refundStatus: 'REQUESTED',
        },
        include: orderInclude,
      });
    });

    paymentLogger.info(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        refundId: refund.id,
        refundAmount,
      },
      'stripe refund requested by admin'
    );

    await writeAuditLog(req, {
      action: 'admin.order.refund_requested',
      entityType: 'Order',
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        refundId: refund.id,
        refundAmount,
        reason: input.reason,
      },
    });

    sendSuccess(res, {
      order: serializeOrder(updated),
      refund: {
        id: refund.id,
        status: refund.status,
        amount: refund.amount,
      },
    });
  })
);

adminRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req);
    const prisma = getPrismaClient();
    const rows = await prisma.product.findMany({
      where: productWhere(query),
      include: productInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const { pageItems, pagination } = paginationMeta(rows, query.limit);

    sendSuccess(res, pageItems.map(serializeProduct), 200, { pagination });
  })
);

adminRouter.post(
  '/products',
  validateBody(productCreateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ProductCreateInput;
    const prisma = getPrismaClient();
    const product = await prisma.product.create({
      data: {
        ...productCreateData(input),
        images: input.images ? { create: imageCreates(input.images) } : undefined,
        inventoryItems: input.inventoryItems
          ? { create: inventoryCreates(input.inventoryItems) }
          : undefined,
      },
      include: productInclude,
    });

    await writeAuditLog(req, {
      action: 'admin.product.created',
      entityType: 'Product',
      entityId: product.id,
      metadata: {
        sku: product.sku,
        slug: product.slug,
      },
    });

    sendSuccess(res, serializeProduct(product), 201);
  })
);

adminRouter.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: productInclude,
    });

    if (!product) {
      throw notFound('Product not found.', { id: req.params.id });
    }

    sendSuccess(res, serializeProduct(product));
  })
);

adminRouter.patch(
  '/products/:id',
  validateBody(productUpdateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ProductUpdateInput;
    const prisma = getPrismaClient();
    const exists = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });

    if (!exists) {
      throw notFound('Product not found.', { id: req.params.id });
    }

    const product = await prisma.$transaction(async (tx) => {
      if (input.images) {
        await tx.productImage.deleteMany({ where: { productId: req.params.id } });
      }

      if (input.inventoryItems) {
        await tx.inventoryItem.deleteMany({ where: { productId: req.params.id } });
      }

      return tx.product.update({
        where: { id: req.params.id },
        data: {
          ...productUpdateData(input),
          images: input.images ? { create: imageCreates(input.images) } : undefined,
          inventoryItems: input.inventoryItems
            ? { create: inventoryCreates(input.inventoryItems) }
            : undefined,
        },
        include: productInclude,
      });
    });

    await writeAuditLog(req, {
      action: 'admin.product.updated',
      entityType: 'Product',
      entityId: product.id,
      metadata: {
        sku: product.sku,
        slug: product.slug,
      },
    });

    sendSuccess(res, serializeProduct(product));
  })
);

adminRouter.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        status: 'ARCHIVED',
        publishedAt: null,
      },
      include: productInclude,
    });

    await writeAuditLog(req, {
      action: 'admin.product.archived',
      entityType: 'Product',
      entityId: product.id,
      metadata: {
        sku: product.sku,
        slug: product.slug,
      },
    });

    sendSuccess(res, serializeProduct(product));
  })
);

adminRouter.put(
  '/products/:id/inventory/:locationKey',
  validateBody(inventoryUpsertSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as InventoryUpsertInput;
    const prisma = getPrismaClient();
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });

    if (!product) {
      throw notFound('Product not found.', { id: req.params.id });
    }

    const locationKey = req.params.locationKey || input.locationKey;
    const inventory = await prisma.inventoryItem.upsert({
      where: {
        productId_locationKey: {
          productId: product.id,
          locationKey,
        },
      },
      update: {
        locationLabel: input.locationLabel,
        quantityOnHand: input.quantityOnHand,
        quantityReserved: input.quantityReserved,
        reorderPoint: input.reorderPoint,
        status: input.status,
        metadata: toPrismaJson(input.metadata),
      },
      create: {
        productId: product.id,
        locationKey,
        locationLabel: input.locationLabel,
        quantityOnHand: input.quantityOnHand,
        quantityReserved: input.quantityReserved,
        reorderPoint: input.reorderPoint,
        status: input.status,
        metadata: toPrismaJson(input.metadata),
      },
    });

    await writeAuditLog(req, {
      action: 'admin.inventory.upserted',
      entityType: 'InventoryItem',
      entityId: inventory.id,
      metadata: {
        productId: product.id,
        locationKey,
      },
    });

    sendSuccess(res, inventory);
  })
);

adminRouter.get(
  '/inventory',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req);
    const prisma = getPrismaClient();
    const rows = await prisma.inventoryItem.findMany({
      where: query.status ? { status: query.status as InventoryStatus } : undefined,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            slug: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const { pageItems, pagination } = paginationMeta(rows, query.limit);

    sendSuccess(res, pageItems, 200, { pagination });
  })
);

adminRouter.patch(
  '/inventory/:id',
  validateBody(inventoryUpdateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as InventoryUpdateInput;
    const prisma = getPrismaClient();
    const inventory = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: {
        locationKey: input.locationKey,
        locationLabel: input.locationLabel,
        quantityOnHand: input.quantityOnHand,
        quantityReserved: input.quantityReserved,
        reorderPoint: input.reorderPoint,
        status: input.status,
        metadata: toPrismaJson(input.metadata),
      },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
      },
    });

    await writeAuditLog(req, {
      action: 'admin.inventory.updated',
      entityType: 'InventoryItem',
      entityId: inventory.id,
      metadata: {
        productId: inventory.productId,
        locationKey: inventory.locationKey,
      },
    });

    sendSuccess(res, inventory);
  })
);

adminRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const prisma = getPrismaClient();
    const categories = await prisma.category.findMany({
      include: categoryInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    sendSuccess(res, categories);
  })
);

adminRouter.post(
  '/categories',
  validateBody(categoryCreateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as CategoryCreateInput;
    const prisma = getPrismaClient();
    const category = await prisma.category.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        parentId: input.parentId,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        metadata: toPrismaJson(input.metadata),
      },
      include: categoryInclude,
    });

    await writeAuditLog(req, {
      action: 'admin.category.created',
      entityType: 'Category',
      entityId: category.id,
      metadata: {
        slug: category.slug,
      },
    });

    sendSuccess(res, category, 201);
  })
);

adminRouter.get(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: categoryInclude,
    });

    if (!category) {
      throw notFound('Category not found.', { id: req.params.id });
    }

    sendSuccess(res, category);
  })
);

adminRouter.patch(
  '/categories/:id',
  validateBody(categoryUpdateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as CategoryUpdateInput;
    const prisma = getPrismaClient();
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        parentId: input.parentId,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        metadata: toPrismaJson(input.metadata),
      },
      include: categoryInclude,
    });

    await writeAuditLog(req, {
      action: 'admin.category.updated',
      entityType: 'Category',
      entityId: category.id,
      metadata: {
        slug: category.slug,
      },
    });

    sendSuccess(res, category);
  })
);

adminRouter.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const category = await prisma.category.delete({
      where: { id: req.params.id },
    });

    await writeAuditLog(req, {
      action: 'admin.category.deleted',
      entityType: 'Category',
      entityId: category.id,
      metadata: {
        slug: category.slug,
      },
    });

    sendSuccess(res, category);
  })
);

adminRouter.get(
  '/articles',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req);
    const prisma = getPrismaClient();
    const rows = await prisma.article.findMany({
      where: {
        ...(query.status ? { status: query.status as Prisma.ArticleWhereInput['status'] } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { slug: { contains: query.q, mode: 'insensitive' } },
                { excerpt: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const { pageItems, pagination } = paginationMeta(rows, query.limit);

    sendSuccess(res, pageItems, 200, { pagination });
  })
);

adminRouter.post(
  '/articles',
  validateBody(articleCreateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ArticleCreateInput;
    const prisma = getPrismaClient();
    const article = await prisma.article.create({
      data: articleCreateData(input),
    });

    await writeAuditLog(req, {
      action: 'admin.article.created',
      entityType: 'Article',
      entityId: article.id,
      metadata: {
        slug: article.slug,
        status: article.status,
      },
    });

    sendSuccess(res, article, 201);
  })
);

adminRouter.get(
  '/articles/:id',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const article = await prisma.article.findUnique({
      where: { id: req.params.id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!article) {
      throw notFound('Article not found.', { id: req.params.id });
    }

    sendSuccess(res, article);
  })
);

adminRouter.patch(
  '/articles/:id',
  validateBody(articleUpdateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ArticleUpdateInput;
    const prisma = getPrismaClient();
    const article = await prisma.article.update({
      where: { id: req.params.id },
      data: articleUpdateData(input),
    });

    await writeAuditLog(req, {
      action: 'admin.article.updated',
      entityType: 'Article',
      entityId: article.id,
      metadata: {
        slug: article.slug,
        status: article.status,
      },
    });

    sendSuccess(res, article);
  })
);

adminRouter.delete(
  '/articles/:id',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const article = await prisma.article.delete({
      where: { id: req.params.id },
    });

    await writeAuditLog(req, {
      action: 'admin.article.deleted',
      entityType: 'Article',
      entityId: article.id,
      metadata: {
        slug: article.slug,
      },
    });

    sendSuccess(res, article);
  })
);

adminRouter.get(
  '/uploads',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req);
    const prisma = getPrismaClient();
    const rows = await prisma.binUpload.findMany({
      where: query.status
        ? { status: query.status as Prisma.BinUploadWhereInput['status'] }
        : undefined,
      include: {
        analysisJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            results: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const { pageItems, pagination } = paginationMeta(rows, query.limit);

    sendSuccess(res, pageItems, 200, { pagination });
  })
);

adminRouter.get(
  '/uploads/:id',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const upload = await prisma.binUpload.findUnique({
      where: { id: req.params.id },
      include: {
        quoteRequest: {
          select: {
            id: true,
            referenceCode: true,
            customerName: true,
            customerEmail: true,
            status: true,
          },
        },
        analysisJobs: {
          orderBy: { createdAt: 'desc' },
          include: {
            results: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!upload) {
      throw notFound('Upload not found.', { id: req.params.id });
    }

    sendSuccess(res, upload);
  })
);

adminRouter.patch(
  '/uploads/:id',
  validateBody(uploadUpdateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as UploadUpdateInput;
    const prisma = getPrismaClient();
    const upload = await prisma.binUpload.update({
      where: { id: req.params.id },
      data: {
        status: input.status,
        requesterName: input.requesterName,
        requesterEmail: input.requesterEmail,
        productContext: input.productContext,
        notes: input.notes,
        rejectionReason: input.rejectionReason,
        metadata: toPrismaJson(input.metadata),
      },
    });

    await writeAuditLog(req, {
      action: 'admin.upload.updated',
      entityType: 'BinUpload',
      entityId: upload.id,
      metadata: {
        status: upload.status,
        storedObjectKey: upload.storedObjectKey,
      },
    });

    sendSuccess(res, upload);
  })
);

adminRouter.delete(
  '/uploads/:id',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const upload = await prisma.binUpload.delete({
      where: { id: req.params.id },
    });

    await writeAuditLog(req, {
      action: 'admin.upload.deleted',
      entityType: 'BinUpload',
      entityId: upload.id,
      metadata: {
        storedObjectKey: upload.storedObjectKey,
      },
    });

    sendSuccess(res, upload);
  })
);

adminRouter.get(
  '/bin-analysis/jobs',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req);
    const prisma = getPrismaClient();
    const rows = await prisma.binAnalysisJob.findMany({
      where: query.status
        ? { status: query.status as Prisma.BinAnalysisJobWhereInput['status'] }
        : undefined,
      include: {
        upload: {
          select: {
            id: true,
            originalFileName: true,
            storedObjectKey: true,
            byteSize: true,
            sha256: true,
            status: true,
            createdAt: true,
          },
        },
        results: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const { pageItems, pagination } = paginationMeta(rows, query.limit);

    sendSuccess(res, pageItems, 200, { pagination });
  })
);

adminRouter.get(
  '/bin-analysis/jobs/:id',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const job = await prisma.binAnalysisJob.findUnique({
      where: { id: req.params.id },
      include: {
        upload: true,
        results: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!job) {
      throw notFound('BIN analysis job not found.', { id: req.params.id });
    }

    sendSuccess(res, job);
  })
);

adminRouter.post(
  '/bin-analysis/uploads/:uploadId/enqueue',
  validateBody(binAnalysisEnqueueSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as BinAnalysisEnqueueInput;
    const result = await enqueueBinAnalysisJob({
      uploadId: req.params.uploadId,
      priority: input.priority,
      force: input.force,
      metadata: {
        ...input.metadata,
        source: 'admin.bin_analysis.enqueue',
        actorId: req.auth?.userId,
      },
    });

    await writeAuditLog(req, {
      action: result.queued ? 'admin.bin_analysis.queued' : 'admin.bin_analysis.queue_skipped',
      entityType: 'BinAnalysisJob',
      entityId: result.job.id,
      metadata: {
        uploadId: req.params.uploadId,
        status: result.job.status,
        force: input.force,
      },
    });

    sendSuccess(res, result.job, result.queued ? 201 : 200);
  })
);

adminRouter.post(
  '/bin-analysis/jobs/:id/retry',
  validateBody(binAnalysisEnqueueSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as BinAnalysisEnqueueInput;
    const job = await retryBinAnalysisJob(req.params.id, input.priority ?? 0);

    await writeAuditLog(req, {
      action: 'admin.bin_analysis.retry_queued',
      entityType: 'BinAnalysisJob',
      entityId: job.id,
      metadata: {
        uploadId: job.uploadId,
        status: job.status,
      },
    });

    sendSuccess(res, job, 202);
  })
);

adminRouter.get(
  '/inquiries',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req);
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';
    const prisma = getPrismaClient();

    if (!['all', 'quote', 'product', 'workshop'].includes(type)) {
      throw badRequest('Invalid inquiry type.', { type });
    }

    const status = query.status as IntakeStatus | undefined;
    const quoteWhere: Prisma.QuoteRequestWhereInput | undefined = status ? { status } : undefined;
    const productInquiryWhere: Prisma.ProductInquiryWhereInput | undefined = status
      ? { status }
      : undefined;
    const workshopWhere: Prisma.WorkshopConsultationLeadWhereInput | undefined = status
      ? { status }
      : undefined;
    const take = query.limit;
    const [quoteRequests, productInquiries, workshopConsultations] = await prisma.$transaction([
      type === 'all' || type === 'quote'
        ? prisma.quoteRequest.findMany({
            where: quoteWhere,
            orderBy: { createdAt: 'desc' },
            take,
          })
        : prisma.quoteRequest.findMany({ where: { id: '__none__' } }),
      type === 'all' || type === 'product'
        ? prisma.productInquiry.findMany({
            where: productInquiryWhere,
            orderBy: { createdAt: 'desc' },
            take,
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  slug: true,
                  name: true,
                },
              },
            },
          })
        : prisma.productInquiry.findMany({ where: { id: '__none__' } }),
      type === 'all' || type === 'workshop'
        ? prisma.workshopConsultationLead.findMany({
            where: workshopWhere,
            orderBy: { createdAt: 'desc' },
            take,
          })
        : prisma.workshopConsultationLead.findMany({ where: { id: '__none__' } }),
    ]);

    sendSuccess(res, {
      quoteRequests,
      productInquiries,
      workshopConsultations,
    });
  })
);

adminRouter.get(
  '/inquiries/:type/:id',
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const { id, type } = req.params;

    if (type === 'quote') {
      const record = await prisma.quoteRequest.findUnique({
        where: { id },
        include: { binUploads: true },
      });
      if (!record) throw notFound('Quote request not found.', { id });
      sendSuccess(res, record);
      return;
    }

    if (type === 'product') {
      const record = await prisma.productInquiry.findUnique({
        where: { id },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              slug: true,
              name: true,
            },
          },
        },
      });
      if (!record) throw notFound('Product inquiry not found.', { id });
      sendSuccess(res, record);
      return;
    }

    if (type === 'workshop') {
      const record = await prisma.workshopConsultationLead.findUnique({ where: { id } });
      if (!record) throw notFound('Workshop consultation not found.', { id });
      sendSuccess(res, record);
      return;
    }

    throw badRequest('Invalid inquiry type.', { type });
  })
);

adminRouter.patch(
  '/inquiries/:type/:id',
  validateBody(inquiryUpdateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as InquiryUpdateInput;
    const prisma = getPrismaClient();
    const { id, type } = req.params;
    let entityType = '';
    let record: unknown;

    if (type === 'quote') {
      entityType = 'QuoteRequest';
      record = await prisma.quoteRequest.update({
        where: { id },
        data: {
          status: input.status,
          metadata: toPrismaJson(input.metadata),
        },
      });
    } else if (type === 'product') {
      entityType = 'ProductInquiry';
      record = await prisma.productInquiry.update({
        where: { id },
        data: {
          status: input.status,
          metadata: toPrismaJson(input.metadata),
        },
      });
    } else if (type === 'workshop') {
      entityType = 'WorkshopConsultationLead';
      record = await prisma.workshopConsultationLead.update({
        where: { id },
        data: {
          status: input.status,
          metadata: toPrismaJson(input.metadata),
        },
      });
    } else {
      throw badRequest('Invalid inquiry type.', { type });
    }

    await writeAuditLog(req, {
      action: 'admin.inquiry.updated',
      entityType,
      entityId: id,
      metadata: {
        type,
        status: input.status,
      },
    });

    sendSuccess(res, record);
  })
);
