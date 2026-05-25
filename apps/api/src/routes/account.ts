import { getPrismaClient } from '@caracal/db';
import { Router, type Request, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { hashPassword, serializeAuthUser, verifyPassword } from '../lib/auth.js';
import { orderInclude, serializeOrder } from '../lib/payments/orders.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import { authenticateAccessToken, requireRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from '../schemas/auth.js';

export const accountRouter: ExpressRouter = Router();

const accountUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  companyName: true,
  workshopName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

accountRouter.use(authenticateAccessToken, requireRoles('customer'));

function getCurrentUser(req: Request) {
  if (!req.auth) {
    throw unauthorized('Authentication required.');
  }

  return req.auth;
}

function parseLimit(value: unknown, fallback = 20): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(raw ?? fallback), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 1), 100);
}

function serializeProfile(user: Awaited<ReturnType<typeof fetchProfile>>) {
  return {
    ...serializeAuthUser(user),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function fetchProfile(userId: string) {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: accountUserSelect,
  });

  if (!user) {
    throw unauthorized('User session is no longer active.');
  }

  return user;
}

function serializeQuoteRequest(
  quoteRequest: Awaited<ReturnType<typeof listQuoteRequests>>[number]
) {
  return {
    id: quoteRequest.id,
    referenceCode: quoteRequest.referenceCode,
    customerName: quoteRequest.customerName,
    customerEmail: quoteRequest.customerEmail,
    customerPhone: quoteRequest.customerPhone,
    companyName: quoteRequest.companyName,
    workshopName: quoteRequest.workshopName,
    vehicleDetails: quoteRequest.vehicleDetails,
    requestedItems: quoteRequest.requestedItems,
    message: quoteRequest.message,
    status: quoteRequest.status,
    source: quoteRequest.source,
    createdAt: quoteRequest.createdAt,
    updatedAt: quoteRequest.updatedAt,
  };
}

function serializeProductInquiry(
  productInquiry: Awaited<ReturnType<typeof listProductInquiries>>[number]
) {
  return {
    id: productInquiry.id,
    referenceCode: productInquiry.referenceCode,
    productId: productInquiry.productId,
    productSku: productInquiry.productSku,
    productName: productInquiry.productName,
    customerName: productInquiry.customerName,
    customerEmail: productInquiry.customerEmail,
    customerPhone: productInquiry.customerPhone,
    companyName: productInquiry.companyName,
    quantity: productInquiry.quantity,
    message: productInquiry.message,
    status: productInquiry.status,
    source: productInquiry.source,
    createdAt: productInquiry.createdAt,
    updatedAt: productInquiry.updatedAt,
  };
}

function serializeUpload(upload: Awaited<ReturnType<typeof listUploads>>[number]) {
  return {
    id: upload.id,
    originalFileName: upload.originalFileName,
    byteSize: upload.byteSize,
    sha256: upload.sha256,
    status: upload.status,
    productContext: upload.productContext,
    notes: upload.notes,
    rejectionReason: upload.rejectionReason,
    quoteRequestId: upload.quoteRequestId,
    createdAt: upload.createdAt,
    updatedAt: upload.updatedAt,
    analysisJobs: upload.analysisJobs.map((job) => ({
      id: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      queuedAt: job.queuedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
    })),
  };
}

async function listQuoteRequests(email: string, limit: number) {
  const prisma = getPrismaClient();
  return prisma.quoteRequest.findMany({
    where: { customerEmail: email },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

async function listProductInquiries(email: string, limit: number) {
  const prisma = getPrismaClient();
  return prisma.productInquiry.findMany({
    where: { customerEmail: email },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

async function listUploads(email: string, limit: number) {
  const prisma = getPrismaClient();
  return prisma.binUpload.findMany({
    where: { requesterEmail: email },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      analysisJobs: {
        orderBy: [{ queuedAt: 'desc' }],
      },
    },
  });
}

accountRouter.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const principal = getCurrentUser(req);
    const user = await fetchProfile(principal.userId);

    sendSuccess(res, { user: serializeProfile(user) });
  })
);

accountRouter.patch(
  '/profile',
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const principal = getCurrentUser(req);
    const input = req.body as UpdateProfileInput;
    const prisma = getPrismaClient();
    const user = await prisma.user.update({
      where: { id: principal.userId },
      data: {
        name: input.name,
        phone: input.phone,
        companyName: input.companyName,
        workshopName: input.workshopName,
      },
      select: accountUserSelect,
    });

    await writeAuditLog(req, {
      actorType: 'USER',
      actorId: principal.userId,
      action: 'account.profile.updated',
      entityType: 'User',
      entityId: principal.userId,
    });

    sendSuccess(res, { user: serializeProfile(user) });
  })
);

accountRouter.patch(
  '/password',
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const principal = getCurrentUser(req);
    const input = req.body as ChangePasswordInput;
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: principal.userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      throw badRequest('Password change is not available for this account.');
    }

    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw unauthorized('Current password is incorrect.');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: principal.userId },
        data: { passwordHash: await hashPassword(input.newPassword) },
        select: { id: true },
      }),
      prisma.refreshToken.updateMany({
        where: {
          userId: principal.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    await writeAuditLog(req, {
      actorType: 'USER',
      actorId: principal.userId,
      action: 'account.password.changed',
      entityType: 'User',
      entityId: principal.userId,
    });

    sendSuccess(res, { changed: true });
  })
);

accountRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const principal = getCurrentUser(req);
    const limit = parseLimit(req.query.limit);
    const prisma = getPrismaClient();
    const orders = await prisma.order.findMany({
      where: {
        OR: [{ userId: principal.userId }, { customerEmail: principal.email }],
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    await writeAuditLog(req, {
      actorType: 'USER',
      actorId: principal.userId,
      action: 'account.orders.listed',
      entityType: 'Order',
      metadata: { resultCount: orders.length },
    });

    sendSuccess(res, orders.map(serializeOrder));
  })
);

accountRouter.get(
  '/inquiries',
  asyncHandler(async (req, res) => {
    const principal = getCurrentUser(req);
    const limit = parseLimit(req.query.limit);
    const [quoteRequests, productInquiries] = await Promise.all([
      listQuoteRequests(principal.email, limit),
      listProductInquiries(principal.email, limit),
    ]);

    await writeAuditLog(req, {
      actorType: 'USER',
      actorId: principal.userId,
      action: 'account.inquiries.listed',
      entityType: 'User',
      entityId: principal.userId,
      metadata: {
        quoteRequests: quoteRequests.length,
        productInquiries: productInquiries.length,
      },
    });

    sendSuccess(res, {
      quoteRequests: quoteRequests.map(serializeQuoteRequest),
      productInquiries: productInquiries.map(serializeProductInquiry),
    });
  })
);

accountRouter.get(
  '/uploads',
  asyncHandler(async (req, res) => {
    const principal = getCurrentUser(req);
    const limit = parseLimit(req.query.limit);
    const uploads = await listUploads(principal.email, limit);

    await writeAuditLog(req, {
      actorType: 'USER',
      actorId: principal.userId,
      action: 'account.uploads.listed',
      entityType: 'BinUpload',
      metadata: { resultCount: uploads.length },
    });

    sendSuccess(res, uploads.map(serializeUpload));
  })
);

accountRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const principal = getCurrentUser(req);
    const prisma = getPrismaClient();
    const user = await fetchProfile(principal.userId);
    const [orders, quoteRequests, productInquiries, uploads] = await Promise.all([
      prisma.order.findMany({
        where: {
          OR: [{ userId: principal.userId }, { customerEmail: principal.email }],
        },
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      listQuoteRequests(principal.email, 5),
      listProductInquiries(principal.email, 5),
      listUploads(principal.email, 5),
    ]);

    sendSuccess(res, {
      user: serializeProfile(user),
      counts: {
        orders: orders.length,
        quoteRequests: quoteRequests.length,
        productInquiries: productInquiries.length,
        uploads: uploads.length,
      },
      recent: {
        orders: orders.map(serializeOrder),
        quoteRequests: quoteRequests.map(serializeQuoteRequest),
        productInquiries: productInquiries.map(serializeProductInquiry),
        uploads: uploads.map(serializeUpload),
      },
    });
  })
);
