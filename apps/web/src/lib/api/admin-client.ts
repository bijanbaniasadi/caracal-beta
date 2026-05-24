/**
 * Admin API client — wired to real backend endpoints.
 *
 * Auth contract:
 *  • Access token  → stored in localStorage under SESSION_KEY (expires ~15 min)
 *  • Refresh token → stored in localStorage under REFRESH_KEY (long-lived)
 *    The refresh token is also sent as an httpOnly cookie by the backend, but we
 *    store it in localStorage too so we can send it in the request body on
 *    cross-origin requests where credentials may not be forwarded automatically.
 *
 * All admin routes live under /api/admin/* and require a Bearer access token.
 * On 401, adminFetch automatically attempts one silent refresh before giving up.
 */

import type {
  AdminArticle,
  AdminBinUpload,
  AdminCategory,
  DashboardMetrics,
  AdminInventoryItem,
  AdminInventoryUpdate,
  LoginInput,
  AdminProduct,
  ProductCreateInput,
  AdminSession,
  BinAnalysisJob,
  EcuAnalysisRun,
  EcuCorpusFile,
  EcuFileCluster,
  EcuOriModPair,
  EcuUnknownFamily,
  InquiriesResponse,
  IntakeRow,
  ListParams,
  LoginResponse,
  PaginatedList,
  QueueHealthResponse,
  RequestQueueRow,
  WorkshopLeadRecord,
  QuoteRequestRecord,
  ProductInquiryRecord,
} from './admin-types';
import type { IntakeStatus } from './types';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const SESSION_KEY = 'caracal_admin_session';
const REFRESH_KEY = 'caracal_admin_refresh';

// ─── Session helpers ──────────────────────────────────────────────────────────

export function getStoredSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    if (new Date(session.accessTokenExpiresAt) < new Date()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function storeSession(loginRes: LoginResponse): AdminSession {
  const session: AdminSession = {
    accessToken: loginRes.accessToken,
    accessTokenExpiresAt: loginRes.accessTokenExpiresAt,
    user: loginRes.user,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(REFRESH_KEY, loginRes.refreshToken);
  return session;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ─── API base ─────────────────────────────────────────────────────────────────

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

// ─── Response envelope ────────────────────────────────────────────────────────

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta: {
    requestId?: string;
    pagination?: {
      limit: number;
      hasMore: boolean;
      nextCursor: string | null;
    };
  };
}

// ─── Cursor cache (page → cursor) ─────────────────────────────────────────────
// Keyed by "<endpoint>|<serialised-filters>". Value is an ordered array of
// cursors where index 0 is the cursor for page 2, index 1 for page 3, etc.

const _cursorCache = new Map<string, Array<string | null>>();

function cursorKey(endpoint: string, params?: ListParams): string {
  const { page: _p, pageSize: _s, ...filters } = params ?? {};
  return `${endpoint}|${JSON.stringify(filters)}`;
}

function getCursorForPage(key: string, page: number): string | undefined {
  if (page <= 1) return undefined;
  return _cursorCache.get(key)?.[page - 2] ?? undefined;
}

function storeCursorForPage(key: string, page: number, nextCursor: string | null): void {
  let arr = _cursorCache.get(key);
  if (!arr) {
    arr = [];
    _cursorCache.set(key, arr);
  }
  arr[page - 1] = nextCursor; // page 1 stores cursor for page 2, etc.
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

let _refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const json = (await res.json()) as ApiEnvelope<LoginResponse>;
    const session = storeSession(json.data);
    return session.accessToken;
  } catch {
    clearSession();
    return null;
  }
}

async function getAccessToken(retry = true): Promise<string | null> {
  const session = getStoredSession();
  if (session) return session.accessToken;
  if (!retry) return null;

  // Access token expired — refresh once
  if (!_refreshing) _refreshing = doRefresh().finally(() => { _refreshing = null; });
  return _refreshing;
}

export async function adminFetch<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ApiEnvelope<T>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Silent token refresh on 401
  if (response.status === 401) {
    const newToken = await getAccessToken(false) ?? await doRefresh();
    if (newToken) {
      const headers2: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Bearer ${newToken}`,
      };
      if (body !== undefined) headers2['Content-Type'] = 'application/json';
      const retried = await fetch(`${getApiBase()}${path}`, {
        method,
        headers: headers2,
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (retried.ok) return retried.json() as Promise<ApiEnvelope<T>>;
      clearSession();
    }
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const err = (await response.json()) as { error?: { message?: string } };
      msg = err?.error?.message ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  return response.json() as Promise<ApiEnvelope<T>>;
}

/** Fetch a list endpoint and convert cursor pagination → PaginatedList. */
async function fetchList<T>(
  endpoint: string,
  params?: ListParams,
): Promise<PaginatedList<T>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const key = cursorKey(endpoint, params);

  // Page 1 clears the cursor cache for this key so subsequent pages are fresh
  if (page === 1) _cursorCache.delete(key);

  const cursor = getCursorForPage(key, page);
  const qs = new URLSearchParams();
  if (params?.search) qs.set('q', params.search);
  if (params?.status) qs.set('status', params.status);
  qs.set('limit', String(pageSize));
  if (cursor) qs.set('cursor', cursor);

  const env = await adminFetch<T[]>('GET', `${endpoint}?${qs.toString()}`);
  const pagination = env.meta.pagination;

  storeCursorForPage(key, page, pagination?.nextCursor ?? null);

  const hasMore = pagination?.hasMore ?? false;
  return {
    items: env.data,
    total: hasMore ? pageSize * page + 1 : (page - 1) * pageSize + env.data.length,
    page,
    pageSize,
    totalPages: hasMore ? page + 1 : page,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** POST /api/auth/login */
export async function adminLogin(input: LoginInput): Promise<AdminSession> {
  const res = await fetch(`${getApiBase()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      msg = err?.error?.message ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  const json = (await res.json()) as ApiEnvelope<LoginResponse>;
  return storeSession(json.data);
}

/** POST /api/auth/logout */
export async function adminLogout(): Promise<void> {
  try {
    await adminFetch<{ loggedOut: boolean }>('POST', '/api/auth/logout', {});
  } catch { /* ignore logout errors */ }
  clearSession();
}

/** GET /api/auth/session */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const env = await adminFetch<{ user: AdminSession['user'] }>('GET', '/api/auth/session');
    const stored = getStoredSession();
    if (!stored) return null;
    // Refresh the user object from server
    const updated: AdminSession = { ...stored, user: env.data.user };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return null;
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

/** GET /api/admin/dashboard/metrics */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const env = await adminFetch<DashboardMetrics>('GET', '/api/admin/dashboard/metrics');
  return env.data;
}

// ─── Products ─────────────────────────────────────────────────────────────────

/** GET /api/admin/products */
export async function listAdminProducts(
  params?: ListParams,
): Promise<PaginatedList<AdminProduct>> {
  return fetchList<AdminProduct>('/api/admin/products', params);
}

/** GET /api/admin/products/:id */
export async function getAdminProduct(id: string): Promise<AdminProduct> {
  const env = await adminFetch<AdminProduct>('GET', `/api/admin/products/${id}`);
  return env.data;
}

/** POST /api/admin/products */
export async function createAdminProduct(
  input: ProductCreateInput,
): Promise<AdminProduct> {
  const env = await adminFetch<AdminProduct>('POST', '/api/admin/products', input);
  return env.data;
}

/** PATCH /api/admin/products/:id */
export async function updateAdminProduct(
  id: string,
  input: Partial<ProductCreateInput>,
): Promise<AdminProduct> {
  const env = await adminFetch<AdminProduct>('PATCH', `/api/admin/products/${id}`, input);
  return env.data;
}

/** DELETE /api/admin/products/:id — archives the product */
export async function deleteAdminProduct(id: string): Promise<void> {
  await adminFetch<AdminProduct>('DELETE', `/api/admin/products/${id}`);
}

// ─── Categories ───────────────────────────────────────────────────────────────

/** GET /api/admin/categories */
export async function listAdminCategories(): Promise<AdminCategory[]> {
  const env = await adminFetch<AdminCategory[]>('GET', '/api/admin/categories');
  return env.data;
}

// ─── Articles ─────────────────────────────────────────────────────────────────

/** GET /api/admin/articles */
export async function listAdminArticles(
  params?: ListParams,
): Promise<PaginatedList<AdminArticle>> {
  return fetchList<AdminArticle>('/api/admin/articles', params);
}

/** GET /api/admin/articles/:id */
export async function getAdminArticle(id: string): Promise<AdminArticle> {
  const env = await adminFetch<AdminArticle>('GET', `/api/admin/articles/${id}`);
  return env.data;
}

/** POST /api/admin/articles */
export async function createAdminArticle(
  input: import('./admin-types').ArticleCreateInput,
): Promise<AdminArticle> {
  const env = await adminFetch<AdminArticle>('POST', '/api/admin/articles', input);
  return env.data;
}

/** PATCH /api/admin/articles/:id */
export async function updateAdminArticle(
  id: string,
  input: Partial<import('./admin-types').ArticleCreateInput>,
): Promise<AdminArticle> {
  const env = await adminFetch<AdminArticle>('PATCH', `/api/admin/articles/${id}`, input);
  return env.data;
}

/** DELETE /api/admin/articles/:id */
export async function deleteAdminArticle(id: string): Promise<void> {
  await adminFetch<unknown>('DELETE', `/api/admin/articles/${id}`);
}

// ─── Inventory ────────────────────────────────────────────────────────────────

function flattenInventoryItem(raw: AdminInventoryItemFull): AdminInventoryItem {
  return {
    id: raw.id,
    productId: raw.productId,
    productName: raw.product.name,
    sku: raw.product.sku,
    status: raw.status,
    quantityOnHand: raw.quantityOnHand,
    quantityReserved: raw.quantityReserved,
    quantityAvailable: Math.max(raw.quantityOnHand - raw.quantityReserved, 0),
    reorderPoint: raw.reorderPoint === 0 ? null : raw.reorderPoint,
    locationKey: raw.locationKey,
  };
}

/** GET /api/admin/inventory */
export async function listInventory(
  params?: ListParams,
): Promise<PaginatedList<AdminInventoryItem>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const key = cursorKey('/api/admin/inventory', params);

  if (page === 1) _cursorCache.delete(key);
  const cursor = getCursorForPage(key, page);

  const qs = new URLSearchParams();
  if (params?.search) qs.set('q', params.search);
  if (params?.status) qs.set('status', params.status);
  qs.set('limit', String(pageSize));
  if (cursor) qs.set('cursor', cursor);

  const env = await adminFetch<AdminInventoryItemFull[]>(
    'GET',
    `/api/admin/inventory?${qs.toString()}`,
  );
  const pagination = env.meta.pagination;
  storeCursorForPage(key, page, pagination?.nextCursor ?? null);

  const hasMore = pagination?.hasMore ?? false;
  const items = env.data.map(flattenInventoryItem);
  return {
    items,
    total: hasMore ? pageSize * page + 1 : (page - 1) * pageSize + items.length,
    page,
    pageSize,
    totalPages: hasMore ? page + 1 : page,
  };
}

/** PATCH /api/admin/inventory/:id */
export async function updateInventory(
  id: string,
  update: AdminInventoryUpdate,
): Promise<AdminInventoryItem> {
  const env = await adminFetch<AdminInventoryItemFull>(
    'PATCH',
    `/api/admin/inventory/${id}`,
    update,
  );
  return flattenInventoryItem(env.data);
}

// ─── Intake / Inquiries ───────────────────────────────────────────────────────

const INTAKE_SLUG_TO_BACKEND: Record<
  'quote-requests' | 'product-inquiries' | 'workshop-leads',
  'quote' | 'product' | 'workshop'
> = {
  'quote-requests': 'quote',
  'product-inquiries': 'product',
  'workshop-leads': 'workshop',
};

function normaliseInquiries(data: InquiriesResponse): IntakeRow[] {
  const rows: IntakeRow[] = [];

  for (const q of data.quoteRequests) {
    rows.push({
      id: q.id,
      type: 'quote_request',
      referenceCode: q.referenceCode,
      contact: q.customerName,
      email: q.customerEmail,
      subject: q.vehicleDetails ?? q.requestedItems[0] ?? q.message.slice(0, 60),
      status: q.status,
      source: q.source,
      createdAt: q.createdAt,
    });
  }

  for (const p of data.productInquiries) {
    rows.push({
      id: p.id,
      type: 'product_inquiry',
      referenceCode: p.referenceCode,
      contact: p.customerName,
      email: p.customerEmail,
      subject: p.productName,
      status: p.status,
      source: p.source,
      createdAt: p.createdAt,
    });
  }

  for (const w of data.workshopConsultations) {
    rows.push({
      id: w.id,
      type: 'workshop_consultation',
      referenceCode: w.referenceCode,
      contact: w.contactName,
      email: w.contactEmail,
      subject: w.workshopName,
      status: w.status,
      source: w.source,
      createdAt: w.createdAt,
    });
  }

  // Sort by newest first
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return rows;
}

/** GET /api/admin/inquiries — returns a normalised IntakeRow[] */
export async function listIntakeRows(
  params?: ListParams,
): Promise<PaginatedList<IntakeRow>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;

  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  qs.set('limit', String(pageSize));

  const env = await adminFetch<InquiriesResponse>(
    'GET',
    `/api/admin/inquiries?${qs.toString()}`,
  );
  const rows = normaliseInquiries(env.data);

  return {
    items: rows,
    total: rows.length,
    page,
    pageSize,
    totalPages: 1,
  };
}

/** PATCH /api/admin/inquiries/:type/:id */
export async function updateIntakeStatus(
  type: 'quote-requests' | 'product-inquiries' | 'workshop-leads',
  id: string,
  status: IntakeStatus,
): Promise<void> {
  const backendType = INTAKE_SLUG_TO_BACKEND[type];
  await adminFetch<unknown>('PATCH', `/api/admin/inquiries/${backendType}/${id}`, { status });
}

// ─── Bin Uploads ──────────────────────────────────────────────────────────────

/** GET /api/admin/uploads */
export async function listBinUploads(
  params?: ListParams,
): Promise<PaginatedList<AdminBinUpload>> {
  return fetchList<AdminBinUpload>('/api/admin/uploads', params);
}

/** GET /api/admin/uploads/:id */
export async function getBinUpload(id: string): Promise<AdminBinUpload> {
  const env = await adminFetch<AdminBinUpload>('GET', `/api/admin/uploads/${id}`);
  return env.data;
}

// ─── BIN Analysis Jobs ────────────────────────────────────────────────────────

/** GET /api/admin/bin-analysis/jobs */
export async function listBinAnalysisJobs(
  params?: ListParams,
): Promise<PaginatedList<BinAnalysisJob>> {
  return fetchList<BinAnalysisJob>('/api/admin/bin-analysis/jobs', params);
}

/** GET /api/admin/bin-analysis/jobs/:id */
export async function getBinAnalysisJob(id: string): Promise<BinAnalysisJob> {
  const env = await adminFetch<BinAnalysisJob>('GET', `/api/admin/bin-analysis/jobs/${id}`);
  return env.data;
}

/** POST /api/admin/bin-analysis/uploads/:uploadId/enqueue */
export async function enqueueBinAnalysisJob(
  uploadId: string,
  priority = 0,
  force = false,
): Promise<BinAnalysisJob> {
  const env = await adminFetch<BinAnalysisJob>(
    'POST',
    `/api/admin/bin-analysis/uploads/${uploadId}/enqueue`,
    { priority, force },
  );
  return env.data;
}

/** POST /api/admin/bin-analysis/jobs/:id/retry */
export async function retryBinAnalysisJob(
  id: string,
  priority = 0,
): Promise<BinAnalysisJob> {
  const env = await adminFetch<BinAnalysisJob>(
    'POST',
    `/api/admin/bin-analysis/jobs/${id}/retry`,
    { priority },
  );
  return env.data;
}

// ─── Queue health ─────────────────────────────────────────────────────────────

/** GET /api/admin/queues/health */
export async function getQueueHealth(): Promise<QueueHealthResponse> {
  const env = await adminFetch<QueueHealthResponse>('GET', '/api/admin/queues/health');
  return env.data;
}

/** POST /api/admin/queues/bin-analysis/cleanup */
export async function cleanupBinAnalysisQueue(): Promise<{ cleanup: unknown; recovery: unknown }> {
  const env = await adminFetch<{ cleanup: unknown; recovery: unknown }>(
    'POST',
    '/api/admin/queues/bin-analysis/cleanup',
  );
  return env.data;
}

// ─── ECU Corpus ───────────────────────────────────────────────────────────────

/** GET /api/admin/ecu-corpus/runtime/metrics */
export async function getCorpusMetrics(runId?: string): Promise<unknown> {
  const qs = runId ? `?runId=${runId}` : '';
  const env = await adminFetch<unknown>('GET', `/api/admin/ecu-corpus/runtime/metrics${qs}`);
  return env.data;
}

/** GET /api/admin/ecu-corpus/runs/latest */
export async function getLatestCorpusRun(): Promise<EcuAnalysisRun> {
  const env = await adminFetch<EcuAnalysisRun>('GET', '/api/admin/ecu-corpus/runs/latest');
  return env.data;
}

/** GET /api/admin/ecu-corpus/files */
export async function listCorpusFiles(
  params?: ListParams & { extension?: string; family?: string; oem?: string },
): Promise<PaginatedList<EcuCorpusFile>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 30;
  const key = cursorKey('/api/admin/ecu-corpus/files', params);

  if (page === 1) _cursorCache.delete(key);
  const cursor = getCursorForPage(key, page);

  const qs = new URLSearchParams();
  if (params?.search) qs.set('q', params.search);
  if (params?.extension) qs.set('extension', params.extension);
  if (params?.family) qs.set('family', params.family);
  if (params?.oem) qs.set('oem', params.oem);
  qs.set('limit', String(pageSize));
  if (cursor) qs.set('cursor', cursor);

  const env = await adminFetch<EcuCorpusFile[]>(
    'GET',
    `/api/admin/ecu-corpus/files?${qs.toString()}`,
  );
  const pagination = env.meta.pagination;
  storeCursorForPage(key, page, pagination?.nextCursor ?? null);

  const hasMore = pagination?.hasMore ?? false;
  return {
    items: env.data,
    total: hasMore ? pageSize * page + 1 : (page - 1) * pageSize + env.data.length,
    page,
    pageSize,
    totalPages: hasMore ? page + 1 : page,
  };
}

/** GET /api/admin/ecu-corpus/clusters */
export async function listCorpusClusters(
  params?: ListParams,
): Promise<PaginatedList<EcuFileCluster>> {
  return fetchList<EcuFileCluster>('/api/admin/ecu-corpus/clusters', params);
}

/** GET /api/admin/ecu-corpus/clusters/unknown */
export async function listUnknownFamilies(
  params?: ListParams,
): Promise<PaginatedList<EcuUnknownFamily>> {
  return fetchList<EcuUnknownFamily>('/api/admin/ecu-corpus/clusters/unknown', params);
}

/** GET /api/admin/ecu-corpus/ori-mod-pairs */
export async function listOriModPairs(
  params?: ListParams,
): Promise<PaginatedList<EcuOriModPair>> {
  return fetchList<EcuOriModPair>('/api/admin/ecu-corpus/ori-mod-pairs', params);
}

/** POST /api/admin/ecu-corpus/scan/enqueue */
export async function enqueueCorpusScan(rootPath: string, maxFiles?: number): Promise<unknown> {
  const env = await adminFetch<unknown>(
    'POST',
    '/api/admin/ecu-corpus/scan/enqueue',
    { rootPath, maxFiles },
  );
  return env.data;
}

/** POST /api/admin/ecu-corpus/pause */
export async function pauseCorpus(runId: string): Promise<unknown> {
  const env = await adminFetch<unknown>('POST', '/api/admin/ecu-corpus/pause', { runId });
  return env.data;
}

/** POST /api/admin/ecu-corpus/resume */
export async function resumeCorpus(runId: string): Promise<unknown> {
  const env = await adminFetch<unknown>('POST', '/api/admin/ecu-corpus/resume', { runId });
  return env.data;
}

/** POST /api/admin/ecu-corpus/reset-failed */
export async function resetFailedCorpusJobs(runId: string): Promise<unknown> {
  const env = await adminFetch<unknown>('POST', '/api/admin/ecu-corpus/reset-failed', { runId });
  return env.data;
}

// ─── Audit logs ───────────────────────────────────────────────────────────────

/** GET /api/admin/audit-logs — NOTE: endpoint may not exist; returns empty list gracefully */
export async function listAuditLogs(
  _params?: ListParams,
): Promise<PaginatedList<import('./admin-types').AuditLogRecord>> {
  // Audit logs are embedded in the dashboard metrics; no dedicated list endpoint yet
  return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
}

// ─── Backward-compat shims ────────────────────────────────────────────────────
// These existed in the old stub client and are referenced by existing hooks.

/** GET /api/admin/inquiries?type=quote — quote requests as RequestQueueRow[] */
export async function listRequestQueue(
  params?: ListParams,
): Promise<PaginatedList<RequestQueueRow>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const qs = new URLSearchParams({ limit: String(pageSize), type: 'quote' });
  if (params?.status) qs.set('status', params.status);
  const env = await adminFetch<InquiriesResponse>('GET', `/api/admin/inquiries?${qs.toString()}`);
  const items: RequestQueueRow[] = env.data.quoteRequests.map((q) => ({
    id: q.id,
    type: 'quote_request' as const,
    referenceCode: q.referenceCode,
    status: q.status,
    customerName: q.customerName,
    createdAt: q.createdAt,
  }));
  return { items, total: items.length, page, pageSize, totalPages: 1 };
}

/** GET /api/admin/inquiries?type=workshop — workshop leads */
export async function listWorkshopLeads(
  params?: ListParams,
): Promise<PaginatedList<WorkshopLeadRecord>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const qs = new URLSearchParams({ limit: String(pageSize), type: 'workshop' });
  if (params?.status) qs.set('status', params.status);
  const env = await adminFetch<InquiriesResponse>('GET', `/api/admin/inquiries?${qs.toString()}`);
  const items: WorkshopLeadRecord[] = env.data.workshopConsultations;
  return { items, total: items.length, page, pageSize, totalPages: 1 };
}

/** GET /api/admin/inquiries?type=quote — alias used by old hook */
export async function listQuoteRequests(
  params?: ListParams,
): Promise<PaginatedList<QuoteRequestRecord>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const qs = new URLSearchParams({ limit: String(pageSize), type: 'quote' });
  const env = await adminFetch<InquiriesResponse>('GET', `/api/admin/inquiries?${qs.toString()}`);
  const items = env.data.quoteRequests;
  return { items, total: items.length, page, pageSize, totalPages: 1 };
}

/** GET /api/admin/inquiries?type=product — alias used by old hook */
export async function listProductInquiries(
  params?: ListParams,
): Promise<PaginatedList<ProductInquiryRecord>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const qs = new URLSearchParams({ limit: String(pageSize), type: 'product' });
  const env = await adminFetch<InquiriesResponse>('GET', `/api/admin/inquiries?${qs.toString()}`);
  const items = env.data.productInquiries;
  return { items, total: items.length, page, pageSize, totalPages: 1 };
}

// ─── Internal helper type (used by flattenInventoryItem) ─────────────────────
// The backend /inventory endpoint returns InventoryItem + nested product.

interface AdminInventoryItemFull {
  id: string;
  productId: string;
  locationKey: string;
  locationLabel: string | null;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
  status: import('./admin-types').InventoryStatus;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    sku: string | null;
    slug: string;
    name: string;
    status: import('./admin-types').ProductStatus;
  };
}
