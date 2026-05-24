import { randomUUID } from 'node:crypto';
import { getPrismaClient } from '@caracal/db';
import { Router, type Router as ExpressRouter } from 'express';

import {
  clearRefreshCookie,
  createRefreshToken,
  getRefreshTokenExpiresAt,
  hashRefreshToken,
  readRefreshTokenFromRequest,
  serializeAuthUser,
  setRefreshCookie,
  signAccessToken,
  verifyPassword,
} from '../lib/auth.js';
import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import { getRequestMetadata } from '../lib/request-metadata.js';
import { authenticateAccessToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rate-limit.js';
import { validateBody } from '../middleware/validate.js';
import {
  loginSchema,
  logoutSchema,
  refreshSessionSchema,
  type LoginInput,
} from '../schemas/auth.js';

export const authRouter: ExpressRouter = Router();

const authUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
} as const;

async function createRefreshTokenRecord(
  userId: string,
  familyId: string,
  req: Parameters<typeof getRequestMetadata>[0]
) {
  const prisma = getPrismaClient();
  const requestMetadata = getRequestMetadata(req);
  const token = createRefreshToken();
  const expiresAt = getRefreshTokenExpiresAt();
  const record = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(token),
      familyId,
      expiresAt,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: toPrismaJson({
        requestId: requestMetadata.requestId,
      }),
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  return {
    token,
    record,
  };
}

function buildAuthResponse(
  user: {
    id: string;
    email: string;
    name: string | null;
    role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
    isActive: boolean;
  },
  refreshToken: string,
  refreshTokenExpiresAt: Date
) {
  const access = signAccessToken(user);

  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken,
    refreshTokenExpiresAt,
    tokenType: 'Bearer',
    user: serializeAuthUser(user),
  };
}

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as LoginInput;
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        ...authUserSelect,
        passwordHash: true,
      },
    });

    if (
      !user?.passwordHash ||
      !user.isActive ||
      !(await verifyPassword(input.password, user.passwordHash))
    ) {
      await writeAuditLog(req, {
        actorType: user ? 'USER' : 'ANONYMOUS',
        actorId: user?.id,
        action: 'auth.login.failed',
        entityType: 'User',
        entityId: user?.id,
        metadata: {
          email: input.email,
          reason: user?.isActive === false ? 'inactive_user' : 'invalid_credentials',
        },
      });

      throw unauthorized('Invalid email or password.');
    }

    const refresh = await createRefreshTokenRecord(user.id, randomUUID(), req);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: { id: true },
    });

    const response = buildAuthResponse(user, refresh.token, refresh.record.expiresAt);
    setRefreshCookie(res, refresh.token);

    await writeAuditLog(req, {
      actorType: 'USER',
      actorId: user.id,
      action: 'auth.login.succeeded',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        refreshTokenId: refresh.record.id,
        role: response.user.role,
      },
    });

    sendSuccess(res, response);
  })
);

authRouter.post(
  '/refresh',
  authLimiter,
  validateBody(refreshSessionSchema),
  asyncHandler(async (req, res) => {
    const refreshToken = readRefreshTokenFromRequest(req);

    if (!refreshToken) {
      throw badRequest('Refresh token is required.');
    }

    const prisma = getPrismaClient();
    const tokenHash = hashRefreshToken(refreshToken);
    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: authUserSelect,
        },
      },
    });

    if (!existing) {
      clearRefreshCookie(res);
      throw unauthorized('Invalid refresh token.');
    }

    if (existing.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: {
          familyId: existing.familyId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      clearRefreshCookie(res);
      await writeAuditLog(req, {
        actorType: 'USER',
        actorId: existing.userId,
        action: 'auth.refresh.reuse_detected',
        entityType: 'RefreshToken',
        entityId: existing.id,
        metadata: {
          familyId: existing.familyId,
        },
      });
      throw unauthorized('Refresh token has already been used.');
    }

    if (existing.expiresAt <= new Date()) {
      clearRefreshCookie(res);
      throw unauthorized('Refresh token expired.');
    }

    if (!existing.user.isActive) {
      clearRefreshCookie(res);
      throw unauthorized('User session is no longer active.');
    }

    const requestMetadata = getRequestMetadata(req);
    const nextRefreshToken = createRefreshToken();
    const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken);
    const nextExpiresAt = getRefreshTokenExpiresAt();

    const nextRecord = await prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: nextRefreshTokenHash,
          familyId: existing.familyId,
          expiresAt: nextExpiresAt,
          ipAddress: requestMetadata.ipAddress,
          userAgent: requestMetadata.userAgent,
          metadata: toPrismaJson({
            rotatedFromTokenId: existing.id,
            requestId: requestMetadata.requestId,
          }),
        },
        select: {
          id: true,
          expiresAt: true,
        },
      });

      await tx.refreshToken.update({
        where: { id: existing.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenId: created.id,
        },
        select: { id: true },
      });

      return created;
    });

    const response = buildAuthResponse(existing.user, nextRefreshToken, nextRecord.expiresAt);
    setRefreshCookie(res, nextRefreshToken);

    await writeAuditLog(req, {
      actorType: 'USER',
      actorId: existing.userId,
      action: 'auth.refresh.succeeded',
      entityType: 'RefreshToken',
      entityId: nextRecord.id,
      metadata: {
        replacedTokenId: existing.id,
        familyId: existing.familyId,
      },
    });

    sendSuccess(res, response);
  })
);

authRouter.post(
  '/logout',
  validateBody(logoutSchema),
  asyncHandler(async (req, res) => {
    const refreshToken = readRefreshTokenFromRequest(req);
    const prisma = getPrismaClient();
    const tokenHash = refreshToken ? hashRefreshToken(refreshToken) : null;
    const tokenRecord = tokenHash
      ? await prisma.refreshToken.updateMany({
          where: {
            tokenHash,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        })
      : null;

    clearRefreshCookie(res);

    await writeAuditLog(req, {
      action: 'auth.logout',
      entityType: 'RefreshToken',
      metadata: {
        revokedCount: tokenRecord?.count ?? 0,
      },
    });

    sendSuccess(res, { loggedOut: true });
  })
);

authRouter.get(
  '/session',
  authenticateAccessToken,
  asyncHandler(async (req, res) => {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: req.auth?.userId },
      select: {
        ...authUserSelect,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw unauthorized('User session is no longer active.');
    }

    sendSuccess(res, {
      user: serializeAuthUser(user),
      session: {
        role: req.auth?.role,
        tokenId: req.auth?.tokenId,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  })
);
