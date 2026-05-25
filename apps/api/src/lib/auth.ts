import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { CookieOptions, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';

import { unauthorized } from './errors.js';

export const authRoles = ['admin', 'staff', 'customer'] as const;
export type AuthRole = (typeof authRoles)[number];

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: AuthRole;
  name?: string;
  type: 'access';
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthenticatedPrincipal {
  userId: string;
  email: string;
  role: AuthRole;
  roles: AuthRole[];
  name?: string;
  tokenId: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  phone?: string | null;
  companyName?: string | null;
  workshopName?: string | null;
  role: UserRole;
  isActive: boolean;
}

export const refreshCookieName = process.env.AUTH_REFRESH_COOKIE_NAME ?? 'caracal_refresh_token';

function getSecret(name: 'JWT_SECRET' | 'REFRESH_TOKEN_SECRET'): string {
  const value = process.env[name]?.trim();

  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be configured in production.`);
  }

  return name === 'JWT_SECRET'
    ? 'dev-secret-at-least-32-characters-long'
    : 'dev-refresh-secret-at-least-32-characters-long';
}

export function getAccessTokenTtlSeconds(): number {
  return Number.parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS ?? '900', 10);
}

export function getRefreshTokenTtlSeconds(): number {
  return Number.parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS ?? String(30 * 24 * 60 * 60), 10);
}

export function roleFromPrisma(role: UserRole): AuthRole {
  return role.toLowerCase() as AuthRole;
}

export function roleToPrisma(role: AuthRole): UserRole {
  return role.toUpperCase() as UserRole;
}

export function serializeAuthUser(user: AuthenticatedUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone ?? null,
    companyName: user.companyName ?? null,
    workshopName: user.workshopName ?? null,
    role: roleFromPrisma(user.role),
    isActive: user.isActive,
  };
}

export async function hashPassword(password: string): Promise<string> {
  const rounds = Number.parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

function encodeBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeBase64UrlJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
}

function signJwtPart(value: string): string {
  return createHmac('sha256', getSecret('JWT_SECRET')).update(value).digest('base64url');
}

function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
  const payload = value as Partial<AccessTokenPayload>;

  return (
    typeof payload.sub === 'string' &&
    typeof payload.email === 'string' &&
    authRoles.includes(payload.role as AuthRole) &&
    payload.type === 'access' &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number' &&
    typeof payload.jti === 'string'
  );
}

export function signAccessToken(user: AuthenticatedUser): {
  token: string;
  expiresAt: Date;
  payload: AccessTokenPayload;
} {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = nowSeconds + getAccessTokenTtlSeconds();
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    role: roleFromPrisma(user.role),
    ...(user.name ? { name: user.name } : {}),
    type: 'access',
    iat: nowSeconds,
    exp: expiresAtSeconds,
    jti: randomUUID(),
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const unsigned = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}`;
  const signature = signJwtPart(unsigned);

  return {
    token: `${unsigned}.${signature}`,
    expiresAt: new Date(expiresAtSeconds * 1000),
    payload,
  };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const [headerPart, payloadPart, signature] = token.split('.');

  if (!headerPart || !payloadPart || !signature) {
    throw unauthorized('Invalid access token.');
  }

  const expected = signJwtPart(`${headerPart}.${payloadPart}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw unauthorized('Invalid access token.');
  }

  const header = decodeBase64UrlJson(headerPart) as { alg?: string; typ?: string };

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw unauthorized('Invalid access token.');
  }

  const payload = decodeBase64UrlJson(payloadPart);

  if (!isAccessTokenPayload(payload)) {
    throw unauthorized('Invalid access token payload.');
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw unauthorized('Access token expired.');
  }

  return payload;
}

export function createRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function createPasswordResetToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHmac('sha256', getSecret('REFRESH_TOKEN_SECRET')).update(token).digest('hex');
}

export function hashPasswordResetToken(token: string): string {
  return createHmac('sha256', getSecret('REFRESH_TOKEN_SECRET'))
    .update(`password-reset:${token}`)
    .digest('hex');
}

export function getRefreshTokenExpiresAt(): Date {
  return new Date(Date.now() + getRefreshTokenTtlSeconds() * 1000);
}

export function getPasswordResetTokenExpiresAt(): Date {
  const ttlSeconds = Number.parseInt(process.env.PASSWORD_RESET_TTL_SECONDS ?? '3600', 10);
  return new Date(Date.now() + ttlSeconds * 1000);
}

function getRefreshCookieOptions(maxAgeSeconds = getRefreshTokenTtlSeconds()): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.AUTH_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: maxAgeSeconds * 1000,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(refreshCookieName, token, getRefreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(refreshCookieName, {
    ...getRefreshCookieOptions(0),
    maxAge: undefined,
  });
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header.split(';').flatMap((cookie) => {
      const [name, ...valueParts] = cookie.trim().split('=');

      if (!name || valueParts.length === 0) {
        return [];
      }

      return [[name, decodeURIComponent(valueParts.join('='))]];
    })
  );
}

export function readRefreshTokenFromRequest(req: Request): string | null {
  const cookieToken = parseCookies(req.get('cookie'))[refreshCookieName];

  if (cookieToken) {
    return cookieToken;
  }

  const body = req.body as { refreshToken?: unknown } | undefined;
  return typeof body?.refreshToken === 'string' && body.refreshToken.trim()
    ? body.refreshToken.trim()
    : null;
}
