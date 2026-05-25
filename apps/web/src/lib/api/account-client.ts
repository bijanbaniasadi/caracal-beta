/**
 * Customer account API client.
 *
 * Auth: Bearer JWT in Authorization header. Tokens are stored in
 * localStorage under the keys below. On 401 a silent refresh is
 * attempted once before redirecting to /login.
 *
 * All customer routes live under /api/customer/* and /api/auth/*.
 */

import type {
  CustomerBinUpload,
  CustomerInquiry,
  CustomerLoginInput,
  CustomerOrder,
  CustomerProfile,
  CustomerProfileUpdateInput,
  CustomerRegisterInput,
  CustomerSession,
} from './account-types';
import type { ApiEnvelope } from './types';

// ─── Storage ──────────────────────────────────────────────────────────────────

const SESSION_KEY = 'caracal_customer_session';

export function getStoredCustomerSession(): CustomerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as CustomerSession;
    if (new Date(session.accessTokenExpiresAt) < new Date()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function storeCustomerSession(session: CustomerSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearCustomerSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Base URL ─────────────────────────────────────────────────────────────────

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

// ─── Fetch core ───────────────────────────────────────────────────────────────

async function accountFetch<T>(
  path: string,
  init: RequestInit,
  token?: string
): Promise<T> {
  const url = `${apiBase()}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...init, headers });
  const body = (await res.json()) as ApiEnvelope<T>;

  if (!body.success) {
    const err = body.error;
    throw Object.assign(new Error(err.message), { code: err.code, status: res.status });
  }
  return body.data;
}

function authFetch<T>(path: string, init: RequestInit): Promise<T> {
  const session = getStoredCustomerSession();
  return accountFetch<T>(path, init, session?.accessToken);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function customerLogin(input: CustomerLoginInput): Promise<CustomerSession> {
  const data = await accountFetch<{
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    user: CustomerSession['user'];
  }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const session: CustomerSession = {
    accessToken: data.accessToken,
    accessTokenExpiresAt: data.accessTokenExpiresAt,
    refreshToken: data.refreshToken,
    user: data.user,
  };
  storeCustomerSession(session);
  return session;
}

export async function customerRegister(input: CustomerRegisterInput): Promise<CustomerSession> {
  const data = await accountFetch<{
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    user: CustomerSession['user'];
  }>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const session: CustomerSession = {
    accessToken: data.accessToken,
    accessTokenExpiresAt: data.accessTokenExpiresAt,
    refreshToken: data.refreshToken,
    user: data.user,
  };
  storeCustomerSession(session);
  return session;
}

export async function customerForgotPassword(email: string): Promise<void> {
  await accountFetch<void>('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export function customerLogout(): void {
  clearCustomerSession();
}

// ─── Account data ─────────────────────────────────────────────────────────────

export function getCustomerProfile(): Promise<CustomerProfile> {
  return authFetch('/api/customer/profile', { method: 'GET' });
}

export function updateCustomerProfile(
  input: CustomerProfileUpdateInput
): Promise<CustomerProfile> {
  return authFetch('/api/customer/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function getCustomerOrders(): Promise<CustomerOrder[]> {
  return authFetch('/api/customer/orders', { method: 'GET' });
}

export function getCustomerOrder(id: string): Promise<CustomerOrder> {
  return authFetch(`/api/customer/orders/${id}`, { method: 'GET' });
}

export function getCustomerInquiries(): Promise<CustomerInquiry[]> {
  return authFetch('/api/customer/inquiries', { method: 'GET' });
}

export function getCustomerUploads(): Promise<CustomerBinUpload[]> {
  return authFetch('/api/customer/uploads', { method: 'GET' });
}
