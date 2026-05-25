/**
 * Customer-facing API type contracts for the account portal.
 *
 * These are derived from the admin types but scoped to what a customer
 * can see about their own data. No admin-only fields are exposed.
 */

import type {
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
  IntakeStatus,
  BinUploadStatus,
} from './admin-types';

export type { OrderStatus, PaymentStatus, FulfillmentStatus, IntakeStatus, BinUploadStatus };

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface CustomerLoginInput {
  email: string;
  password: string;
}

export interface CustomerRegisterInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  companyName?: string;
  workshopName?: string;
}

export interface CustomerSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    companyName: string | null;
  };
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface CustomerOrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  currency: string;
  slug: string | null;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  currency: string;
  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  items: CustomerOrderItem[];
  trackingNumber: string | null;
  notes: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Inquiries ────────────────────────────────────────────────────────────────

export type InquiryType =
  | 'TUNING_QUOTE'
  | 'FILE_SERVICE'
  | 'TECHNICAL_SUPPORT'
  | 'ORDER_SUPPORT'
  | 'GENERAL'
  | 'quote_request'
  | 'product_inquiry'
  | 'workshop_consultation';

export interface CustomerInquiry {
  id: string;
  type: InquiryType;
  referenceCode: string;
  subject: string;
  status: IntakeStatus;
  message: string;
  vehicle: string | null;
  ecuType: string | null;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  binUploads?: Array<{ id: string; originalFileName: string; status: BinUploadStatus }>;
}

// ─── BIN Uploads ──────────────────────────────────────────────────────────────

export interface CustomerBinUpload {
  id: string;
  fileName: string;
  originalFileName: string;
  fileSize: number | null;
  byteSize: number;
  sha256: string;
  status: BinUploadStatus;
  vehicleMake: string | null;
  ecuModel: string | null;
  softwareVersion: string | null;
  productContext: string | null;
  notes: string | null;
  rejectionReason: string | null;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
  linkedQuoteRef: string | null;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface CustomerProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  company: string | null;
  companyName: string | null;
  workshopName: string | null;
  country: string | null;
  createdAt: string;
}

export interface CustomerProfileUpdateInput {
  name?: string;
  phone?: string;
  company?: string;
  companyName?: string;
  workshopName?: string;
  country?: string;
}

export interface CustomerPasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}
