/**
 * Caracal API — Frontend type contracts
 *
 * These types are derived from the backend Zod schemas and Prisma select
 * shapes. They are intentionally kept in sync with:
 *   apps/api/src/schemas/intake.ts        — input validation rules
 *   apps/api/src/routes/*.ts              — response select objects
 *   apps/api/src/lib/api-response.ts      — response envelope
 *   apps/api/src/middleware/error-handler.ts — error codes
 *
 * Do NOT import from apps/api directly — the API is a separate runtime.
 */

// ─── Envelope ──────────────────────────────────────────────────────────────

export interface ApiMeta {
  requestId?: string;
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    /**
     * Present on validation_error: the result of Zod's error.flatten()
     * { formErrors: string[], fieldErrors: Record<string, string[]> }
     */
    details?: ZodFlattenedError | unknown;
  };
  meta: ApiMeta;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

// ─── Zod flatten shape (validation_error details) ──────────────────────────

export interface ZodFlattenedError {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
}

// ─── Error codes (all codes the backend can return) ────────────────────────

export type ApiErrorCode =
  | 'bad_request'
  | 'validation_error'
  | 'not_found'
  | 'rate_limited'
  | 'upload_error'
  | 'internal_server_error'
  // catch-all for unknown codes returned by proxies / future additions
  | (string & {});

// ─── Domain enums (mirror Prisma enum values) ──────────────────────────────

export type IntakeStatus = 'NEW' | 'IN_REVIEW' | 'RESPONDED' | 'CLOSED' | 'SPAM';

export type BinUploadStatus = 'RECEIVED' | 'VALIDATED' | 'REJECTED' | 'STORED';

export type StorageProvider = 'LOCAL' | 'R2';

// ─── Response data shapes (from Prisma select objects in each route) ────────

/**
 * Returned from POST /api/quote-requests
 *                  POST /api/product-inquiries
 *                  POST /api/workshop-consultations
 *
 * referenceCode format: {prefix}-{YYYYMMDD}-{8 hex uppercase}
 * e.g. QR-20260524-ABCD1234, PI-20260524-ABCD1234, WC-20260524-ABCD1234
 */
export interface IntakeConfirmation {
  id: string;
  referenceCode: string;
  status: IntakeStatus;
  createdAt: string; // ISO 8601 – Prisma serialises DateTime → string
}

/**
 * Returned from POST /api/bin-uploads
 */
export interface BinUploadConfirmation {
  id: string;
  originalFileName: string;
  storedObjectKey: string;
  storageProvider: StorageProvider;
  byteSize: number;
  sha256: string;
  status: BinUploadStatus;
  createdAt: string; // ISO 8601
}

/**
 * Returned from GET /health  (plain JSON, no envelope)
 */
export interface ApiHealth {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  timestamp: string; // ISO 8601
}

// ─── Request input types (mirror backend Zod schemas) ──────────────────────
//
// Rules derived from apps/api/src/schemas/intake.ts:
//   requiredText(n)  → string, trimmed, min 1, max n
//   optionalText(n)  → string | undefined, trimmed, min 1, max n
//   email            → string, email format, max 254, lowercased by backend
//   phone            → string | undefined, 7–40 chars

/**
 * POST /api/quote-requests
 */
export interface QuoteRequestInput {
  /** max 160 */
  customerName: string;
  /** valid email, max 254 */
  customerEmail: string;
  /** max 4000 */
  message: string;
  /** 7–40 chars */
  customerPhone?: string;
  /** max 160 */
  companyName?: string;
  /** max 160 */
  workshopName?: string;
  /** max 500 */
  vehicleDetails?: string;
  /** max 25 items, each max 160 chars */
  requestedItems?: string[];
  /**
   * Origin tag for analytics.
   * Defaults to 'web' when submitted via this client.
   * Backend accepts any string up to 80 chars.
   */
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/product-inquiries
 */
export interface ProductInquiryInput {
  /** max 200 */
  productName: string;
  /** max 160 */
  customerName: string;
  /** valid email, max 254 */
  customerEmail: string;
  /** max 3000 */
  message: string;
  /** max 120 */
  productId?: string;
  /** max 120 — e.g. 'kess3-master' */
  productSku?: string;
  /** 7–40 chars */
  customerPhone?: string;
  /** max 160 */
  companyName?: string;
  /** positive integer, max 100 000 */
  quantity?: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/workshop-consultations
 */
export interface WorkshopConsultationInput {
  /** max 180 */
  workshopName: string;
  /** max 160 */
  contactName: string;
  /** valid email, max 254 */
  contactEmail: string;
  /** max 4000 */
  message: string;
  /** 7–40 chars */
  contactPhone?: string;
  /** max 240 — city / emirate */
  location?: string;
  /** non-negative integer, max 100 000 */
  monthlyVolume?: number;
  /** max 30 items, each max 160 chars */
  serviceInterests?: string[];
  /** max 120 — e.g. 'Within 3 months' */
  preferredTimeline?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/bin-uploads  (multipart/form-data)
 *
 * The `file` field is handled by the client as a File/Blob object.
 * All other fields are appended to FormData as strings.
 *
 * File constraints (enforced by backend):
 *   - extension: .bin only
 *   - MIME: application/octet-stream (or empty)
 *   - max size: BIN_UPLOAD_MAX_SIZE env (default 50 MB)
 *   - non-empty
 */
export interface BinUploadInput {
  /** .bin File (browser File API) */
  file: File;
  /** max 160 */
  requesterName?: string;
  /** valid email */
  requesterEmail?: string;
  /** max 240 — e.g. 'KESS3 Master' */
  productContext?: string;
  /** CUID of an existing QuoteRequest to link this upload to */
  quoteRequestId?: string;
  /** max 1200 */
  notes?: string;
}
