import { readBearerToken } from '@caracal/auth';
import { getPrismaClient } from '@caracal/db';
import type { NextFunction, Request, Response } from 'express';

import type { AuthRole, AuthenticatedPrincipal } from '../lib/auth.js';
import { roleFromPrisma, verifyAccessToken } from '../lib/auth.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export async function authenticateAccessToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = readBearerToken(req.get('authorization'));

    if (!token) {
      throw unauthorized('Bearer access token required.');
    }

    const payload = verifyAccessToken(token);
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw unauthorized('User session is no longer active.');
    }

    const role = roleFromPrisma(user.role);
    const principal: AuthenticatedPrincipal = {
      userId: user.id,
      email: user.email,
      role,
      roles: [role],
      ...(user.name ? { name: user.name } : {}),
      tokenId: payload.jti,
    };

    req.auth = principal;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...allowedRoles: AuthRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(unauthorized('Authentication required.'));
      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
      next(forbidden('You do not have access to this resource.', { allowedRoles }));
      return;
    }

    next();
  };
}

export const requireAdminSession = [authenticateAccessToken, requireRoles('admin', 'staff')];
export const requireAdminRole = [authenticateAccessToken, requireRoles('admin')];
