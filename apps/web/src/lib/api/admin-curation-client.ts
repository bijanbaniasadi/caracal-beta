import { adminFetch } from './admin-client';
import type {
  AdminAuditRecord,
  AdminReviewDashboard,
  AdminReviewQueueItem,
  ImageIntegrityReport,
  IngestionObservability,
  PricingWorkflow,
  ReconciliationReport,
  ReviewCreateMasterInput,
  ReviewStatusFilter,
} from './admin-curation-types';

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const value = search.toString();
  return value ? `?${value}` : '';
}

export async function getCurationDashboard(): Promise<AdminReviewDashboard> {
  const result = await adminFetch<AdminReviewDashboard>(
    'GET',
    '/api/admin/catalog/curation/dashboard'
  );
  return result.data;
}

export async function listReviewQueue(
  status: ReviewStatusFilter = 'open',
  limit = 25
): Promise<AdminReviewQueueItem[]> {
  const result = await adminFetch<AdminReviewQueueItem[]>(
    'GET',
    `/api/admin/review-queue${query({ status, limit })}`
  );
  return result.data;
}

export async function approveReviewMatch(
  id: string,
  input: { masterProductId?: string; confidence?: number; notes?: string | null }
): Promise<AdminReviewQueueItem> {
  const result = await adminFetch<AdminReviewQueueItem>(
    'POST',
    `/api/admin/review-queue/${id}/approve-match`,
    input
  );
  return result.data;
}

export async function createMasterFromReview(
  id: string,
  input: ReviewCreateMasterInput
): Promise<AdminReviewQueueItem> {
  const result = await adminFetch<AdminReviewQueueItem>(
    'POST',
    `/api/admin/review-queue/${id}/create`,
    input
  );
  return result.data;
}

export async function rejectReviewItem(id: string, reason: string): Promise<AdminReviewQueueItem> {
  const result = await adminFetch<AdminReviewQueueItem>(
    'POST',
    `/api/admin/review-queue/${id}/reject`,
    { reason }
  );
  return result.data;
}

export async function archiveReviewItem(id: string, reason: string): Promise<AdminReviewQueueItem> {
  const result = await adminFetch<AdminReviewQueueItem>(
    'POST',
    `/api/admin/review-queue/${id}/archive`,
    { reason }
  );
  return result.data;
}

export async function mergeReviewDuplicate(
  id: string,
  input: { canonicalRawProductId: string; reason: string }
): Promise<AdminReviewQueueItem> {
  const result = await adminFetch<AdminReviewQueueItem>(
    'POST',
    `/api/admin/review-queue/${id}/merge-duplicate`,
    input
  );
  return result.data;
}

export async function refingerprintReviewItem(
  id: string,
  reason?: string
): Promise<AdminReviewQueueItem> {
  const result = await adminFetch<AdminReviewQueueItem>(
    'POST',
    `/api/admin/review-queue/${id}/refingerprint`,
    reason ? { reason } : {}
  );
  return result.data;
}

export async function getImageIntegrityReport(): Promise<ImageIntegrityReport> {
  const result = await adminFetch<ImageIntegrityReport>(
    'GET',
    '/api/admin/catalog/curation/images/integrity'
  );
  return result.data;
}

export async function getPricingWorkflow(productId: string): Promise<PricingWorkflow> {
  const result = await adminFetch<PricingWorkflow>(
    'GET',
    `/api/admin/catalog/curation/pricing/${productId}`
  );
  return result.data;
}

export async function curateProductPrice(
  productId: string,
  input: { offerId?: string | null; priceCents: string; currency: string; reason?: string | null }
): Promise<unknown> {
  const result = await adminFetch<unknown>(
    'POST',
    `/api/admin/catalog/curation/pricing/${productId}/curate`,
    input
  );
  return result.data;
}

export async function getIngestionObservability(): Promise<IngestionObservability> {
  const result = await adminFetch<IngestionObservability>(
    'GET',
    '/api/admin/catalog/curation/observability'
  );
  return result.data;
}

export async function getReconciliationReport(): Promise<ReconciliationReport> {
  const result = await adminFetch<ReconciliationReport>(
    'GET',
    '/api/admin/catalog/curation/reconciliation'
  );
  return result.data;
}

export async function enqueueReconciliation(
  type: 'projection-consistency' | 'search-count' | 'full-reconcile',
  reason: string
): Promise<unknown> {
  const result = await adminFetch<unknown>(
    'POST',
    '/api/admin/catalog/curation/reconciliation/enqueue',
    { type, reason }
  );
  return result.data;
}

export async function getAdminAuditVisibility(limit = 50): Promise<AdminAuditRecord[]> {
  const result = await adminFetch<AdminAuditRecord[]>(
    'GET',
    `/api/admin/catalog/curation/audit${query({ limit })}`
  );
  return result.data;
}
