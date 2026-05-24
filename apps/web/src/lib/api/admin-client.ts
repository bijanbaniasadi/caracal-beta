/**
 * Admin API client.
 *
 * Stub bodies return empty data so the frontend can be built and verified
 * independently of the backend. Replace each stub with a real fetch call once
 * the corresponding backend route is implemented:
 *
 *   return adminFetch<T>('GET', '/api/admin/...');
 *   return adminFetch<T>('POST', '/api/admin/...', body);
 */

import type {
  AdminArticleDetail,
  AdminArticleInput,
  AdminArticleListItem,
  AdminDashboardMetrics,
  AdminInventoryItem,
  AdminInventoryUpdate,
  AdminLoginInput,
  AdminProductDetail,
  AdminProductInput,
  AdminProductListItem,
  AdminSession,
  AuditLogRecord,
  BinUploadRecord,
  IntakeRow,
  ListParams,
  PaginatedList,
  ProductInquiryRecord,
  QuoteRequestRecord,
  RequestQueueRow,
  WorkshopLeadRecord,
} from './admin-types';
import type { IntakeStatus } from './types';

// ─── Session helpers ──────────────────────────────────────────────────────────

const SESSION_KEY = 'caracal_admin_session';

export function getStoredSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    if (new Date(session.expiresAt) < new Date()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function storeSession(session: AdminSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyPage<T>(): PaginatedList<T> {
  return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
}

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export async function adminFetch<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const session = getStoredSession();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const err = (await response.json()) as { error?: { message?: string } };
      msg = err?.error?.message ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  return response.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** POST /api/admin/auth/login */
export async function adminLogin(input: AdminLoginInput): Promise<AdminSession> {
  // TODO: replace stub with adminFetch<AdminSession>('POST', '/api/admin/auth/login', input);
  // For now: accept env-var credentials client-side (dev only)
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'admin@caracaltechmotors.com';
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'caracal-admin-dev';

  if (input.email === adminEmail && input.password === adminPassword) {
    const session: AdminSession = {
      token: 'dev-admin-token',
      userId: 'dev-admin-001',
      email: input.email,
      role: 'SUPER_ADMIN',
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8h
    };
    storeSession(session);
    return session;
  }
  throw new Error('Invalid credentials');
}

/** POST /api/admin/auth/logout */
export async function adminLogout(): Promise<void> {
  clearSession();
  // TODO: await adminFetch<void>('POST', '/api/admin/auth/logout');
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

/** GET /api/admin/dashboard/metrics */
export async function getDashboardMetrics(): Promise<AdminDashboardMetrics> {
  // TODO: return adminFetch<AdminDashboardMetrics>('GET', '/api/admin/dashboard/metrics');
  return {
    totalProducts: 0,
    activeProducts: 0,
    draftProducts: 0,
    totalArticles: 0,
    publishedArticles: 0,
    newInquiries: 0,
    pendingUploads: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
  };
}

// ─── Products ─────────────────────────────────────────────────────────────────

/** GET /api/admin/products */
export async function listAdminProducts(
  _params?: ListParams,
): Promise<PaginatedList<AdminProductListItem>> {
  return emptyPage<AdminProductListItem>();
}

/** GET /api/admin/products/:id */
export async function getAdminProduct(_id: string): Promise<AdminProductDetail> {
  throw new Error('Not implemented');
}

/** POST /api/admin/products */
export async function createAdminProduct(
  _input: AdminProductInput,
): Promise<AdminProductDetail> {
  throw new Error('Not implemented');
}

/** PATCH /api/admin/products/:id */
export async function updateAdminProduct(
  _id: string,
  _input: Partial<AdminProductInput>,
): Promise<AdminProductDetail> {
  throw new Error('Not implemented');
}

/** DELETE /api/admin/products/:id */
export async function deleteAdminProduct(_id: string): Promise<void> {
  throw new Error('Not implemented');
}

// ─── Inventory ────────────────────────────────────────────────────────────────

/** GET /api/admin/inventory */
export async function listInventory(
  _params?: ListParams,
): Promise<PaginatedList<AdminInventoryItem>> {
  return emptyPage<AdminInventoryItem>();
}

/** PATCH /api/admin/inventory/:productId */
export async function updateInventory(
  _productId: string,
  _update: AdminInventoryUpdate,
): Promise<AdminInventoryItem> {
  throw new Error('Not implemented');
}

// ─── Articles ─────────────────────────────────────────────────────────────────

/** GET /api/admin/articles */
export async function listAdminArticles(
  _params?: ListParams,
): Promise<PaginatedList<AdminArticleListItem>> {
  return emptyPage<AdminArticleListItem>();
}

/** GET /api/admin/articles/:id */
export async function getAdminArticle(_id: string): Promise<AdminArticleDetail> {
  throw new Error('Not implemented');
}

/** POST /api/admin/articles */
export async function createAdminArticle(
  _input: AdminArticleInput,
): Promise<AdminArticleDetail> {
  throw new Error('Not implemented');
}

/** PATCH /api/admin/articles/:id */
export async function updateAdminArticle(
  _id: string,
  _input: Partial<AdminArticleInput>,
): Promise<AdminArticleDetail> {
  throw new Error('Not implemented');
}

/** DELETE /api/admin/articles/:id */
export async function deleteAdminArticle(_id: string): Promise<void> {
  throw new Error('Not implemented');
}

// ─── Intake endpoints ─────────────────────────────────────────────────────────

/** GET /api/admin/intake */
export async function listIntakeRows(
  _params?: ListParams,
): Promise<PaginatedList<IntakeRow>> {
  return emptyPage<IntakeRow>();
}

/** GET /api/admin/quote-requests */
export async function listQuoteRequests(
  _params?: ListParams,
): Promise<PaginatedList<QuoteRequestRecord>> {
  return emptyPage<QuoteRequestRecord>();
}

/** GET /api/admin/product-inquiries */
export async function listProductInquiries(
  _params?: ListParams,
): Promise<PaginatedList<ProductInquiryRecord>> {
  return emptyPage<ProductInquiryRecord>();
}

/** GET /api/admin/request-queue */
export async function listRequestQueue(
  _params?: ListParams,
): Promise<PaginatedList<RequestQueueRow>> {
  return emptyPage<RequestQueueRow>();
}

/** GET /api/admin/workshop-leads */
export async function listWorkshopLeads(
  _params?: ListParams,
): Promise<PaginatedList<WorkshopLeadRecord>> {
  return emptyPage<WorkshopLeadRecord>();
}

/** PATCH /api/admin/intake/:type/:id/status */
export async function updateIntakeStatus(
  _type: 'quote-requests' | 'product-inquiries' | 'workshop-leads',
  _id: string,
  _status: IntakeStatus,
): Promise<void> {
  throw new Error('Not implemented');
}

// ─── Upload endpoint ──────────────────────────────────────────────────────────

/** GET /api/admin/bin-uploads */
export async function listBinUploads(
  _params?: ListParams,
): Promise<PaginatedList<BinUploadRecord>> {
  return emptyPage<BinUploadRecord>();
}

// ─── Audit endpoint ───────────────────────────────────────────────────────────

/** GET /api/admin/audit-logs */
export async function listAuditLogs(
  _params?: ListParams,
): Promise<PaginatedList<AuditLogRecord>> {
  return emptyPage<AuditLogRecord>();
}
