/**
 * Caracal API client — public surface
 *
 * Import from here in page/component code:
 *
 *   import {
 *     submitQuoteRequest,
 *     submitProductInquiry,
 *     submitWorkshopConsultation,
 *     uploadBin,
 *     getHealth,
 *     CaracalApiError,
 *   } from '@/lib/api';
 *
 * Import types only when you need them for annotations / prop types:
 *
 *   import type { QuoteRequestInput, IntakeConfirmation } from '@/lib/api';
 */

// Functions + error class
export {
  CaracalApiError,
  getHealth,
  submitProductInquiry,
  submitQuoteRequest,
  submitWorkshopConsultation,
  uploadBin,
} from './client';

// All types (re-exported for convenience — tree-shaken at build time)
export type {
  ApiEnvelope,
  ApiErrorCode,
  ApiFailure,
  ApiHealth,
  ApiMeta,
  ApiSuccess,
  BinUploadConfirmation,
  BinUploadInput,
  BinUploadStatus,
  IntakeConfirmation,
  IntakeStatus,
  ProductInquiryInput,
  QuoteRequestInput,
  StorageProvider,
  WorkshopConsultationInput,
  ZodFlattenedError,
} from './types';
