/**
 * Caracal API — Typed HTTP client
 *
 * All intake endpoints return ApiEnvelope<T>; GET /health returns plain JSON.
 * BinUpload uses multipart/form-data; all other requests use JSON.
 *
 * Usage:
 *   import { submitQuoteRequest, uploadBin, getHealth } from '@/lib/api';
 */

import type {
  ApiEnvelope,
  ApiErrorCode,
  ApiHealth,
  BinUploadConfirmation,
  BinUploadInput,
  IntakeConfirmation,
  ProductInquiryInput,
  QuoteRequestInput,
  WorkshopConsultationInput,
  ZodFlattenedError,
} from './types';

// ─── Base URL ───────────────────────────────────────────────────────────────

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

// ─── Error class ────────────────────────────────────────────────────────────

export class CaracalApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: ZodFlattenedError | unknown;
  readonly requestId: string | undefined;

  constructor(opts: {
    code: ApiErrorCode;
    message: string;
    status: number;
    details?: ZodFlattenedError | unknown;
    requestId?: string;
  }) {
    super(opts.message);
    this.name = 'CaracalApiError';
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
    this.requestId = opts.requestId;
  }

  /** Returns true when the error carries Zod field-level validation details. */
  isValidationError(): boolean {
    return this.code === 'validation_error';
  }

  /** Returns the flattened Zod error shape, or null if not a validation error. */
  getFieldErrors(): ZodFlattenedError | null {
    if (!this.isValidationError()) return null;
    const d = this.details as ZodFlattenedError | undefined;
    if (d && typeof d === 'object' && 'fieldErrors' in d) return d;
    return null;
  }
}

// ─── Core fetch wrapper (envelope routes) ───────────────────────────────────

/**
 * Wraps fetch for envelope-based API routes.
 * - Resolves to the unwrapped `data` value on success.
 * - Throws `CaracalApiError` on any API or network failure.
 */
async function caracalFetch<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  const url = `${getApiBase()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
      },
    });
  } catch (networkError) {
    throw new CaracalApiError({
      code: 'internal_server_error',
      message:
        networkError instanceof Error
          ? networkError.message
          : 'Network request failed',
      status: 0,
    });
  }

  // Parse JSON body (even error responses are JSON)
  let body: ApiEnvelope<T>;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new CaracalApiError({
      code: 'internal_server_error',
      message: `Server returned non-JSON response (HTTP ${response.status})`,
      status: response.status,
    });
  }

  if (body.success) {
    return body.data;
  }

  throw new CaracalApiError({
    code: body.error.code,
    message: body.error.message,
    status: response.status,
    details: body.error.details,
    requestId: body.meta?.requestId,
  });
}

// ─── JSON POST helper ────────────────────────────────────────────────────────

function postJson<TInput, TResponse>(
  path: string,
  body: TInput
): Promise<TResponse> {
  return caracalFetch<TResponse>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Public API functions ────────────────────────────────────────────────────

/**
 * POST /api/quote-requests
 *
 * Submits a quote request. Returns `IntakeConfirmation` with a reference code
 * in the format `QR-{YYYYMMDD}-{8hexUPPER}`.
 */
export function submitQuoteRequest(
  input: QuoteRequestInput
): Promise<IntakeConfirmation> {
  return postJson<QuoteRequestInput, IntakeConfirmation>(
    '/api/quote-requests',
    { source: 'web', ...input }
  );
}

/**
 * POST /api/product-inquiries
 *
 * Submits a product inquiry. Returns `IntakeConfirmation` with reference code
 * in the format `PI-{YYYYMMDD}-{8hexUPPER}`.
 */
export function submitProductInquiry(
  input: ProductInquiryInput
): Promise<IntakeConfirmation> {
  return postJson<ProductInquiryInput, IntakeConfirmation>(
    '/api/product-inquiries',
    { source: 'web', ...input }
  );
}

/**
 * POST /api/workshop-consultations
 *
 * Submits a workshop consultation lead. Returns `IntakeConfirmation` with
 * reference code in the format `WC-{YYYYMMDD}-{8hexUPPER}`.
 */
export function submitWorkshopConsultation(
  input: WorkshopConsultationInput
): Promise<IntakeConfirmation> {
  return postJson<WorkshopConsultationInput, IntakeConfirmation>(
    '/api/workshop-consultations',
    { source: 'web', ...input }
  );
}

/**
 * POST /api/bin-uploads  (multipart/form-data)
 *
 * Uploads a .bin file with optional metadata fields. Constraints:
 *   - `.bin` extension only
 *   - Max size: 50 MB (configurable via BIN_UPLOAD_MAX_SIZE on the backend)
 *   - MIME: application/octet-stream or empty
 *
 * Do NOT set Content-Type manually — the browser sets it with the correct
 * multipart boundary when using FormData.
 */
export function uploadBin(
  input: BinUploadInput
): Promise<BinUploadConfirmation> {
  const form = new FormData();
  form.append('file', input.file);

  if (input.requesterName !== undefined) form.append('requesterName', input.requesterName);
  if (input.requesterEmail !== undefined) form.append('requesterEmail', input.requesterEmail);
  if (input.productContext !== undefined) form.append('productContext', input.productContext);
  if (input.quoteRequestId !== undefined) form.append('quoteRequestId', input.quoteRequestId);
  if (input.notes !== undefined) form.append('notes', input.notes);

  return caracalFetch<BinUploadConfirmation>('/api/bin-uploads', {
    method: 'POST',
    // No Content-Type header — let the browser set multipart/form-data with boundary
    body: form,
  });
}

/**
 * GET /health
 *
 * Returns the API health status. This endpoint does NOT use the standard
 * ApiEnvelope — it returns a plain JSON object directly.
 */
export async function getHealth(): Promise<ApiHealth> {
  const url = `${getApiBase()}/health`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch (networkError) {
    throw new CaracalApiError({
      code: 'internal_server_error',
      message:
        networkError instanceof Error
          ? networkError.message
          : 'Network request failed',
      status: 0,
    });
  }

  if (!response.ok) {
    throw new CaracalApiError({
      code: 'internal_server_error',
      message: `Health check failed (HTTP ${response.status})`,
      status: response.status,
    });
  }

  return response.json() as Promise<ApiHealth>;
}
