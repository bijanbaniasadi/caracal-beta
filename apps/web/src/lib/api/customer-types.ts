export type AuthRole = 'admin' | 'staff' | 'customer';

export interface CustomerUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  companyName: string | null;
  workshopName: string | null;
  role: AuthRole;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: CustomerUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  companyName?: string;
  workshopName?: string;
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  tokenType: 'Bearer';
  user: CustomerUser;
}

export interface ForgotPasswordResponse {
  accepted: true;
  expiresAt?: string;
  resetUrl?: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface UpdateProfileInput {
  name: string;
  phone?: string | null;
  companyName?: string | null;
  workshopName?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'FULFILLING'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';
export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';
export type FulfillmentStatus =
  | 'UNFULFILLED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';
export type IntakeStatus = 'NEW' | 'IN_REVIEW' | 'RESPONDED' | 'CLOSED' | 'SPAM';
export type BinUploadStatus = 'RECEIVED' | 'VALIDATED' | 'REJECTED' | 'STORED';

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  customer: {
    email: string | null;
    name: string | null;
    phone: string | null;
  };
  amounts: {
    currency: string;
    subtotalCents: number;
    shippingCents: number;
    taxCents: number;
    discountCents: number;
    totalCents: number;
  };
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  refundStatus: string;
  shippingTracking: string | null;
  items: Array<{
    id: string;
    productId: string | null;
    sku: string | null;
    slug: string | null;
    name: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    currency: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteRequestRecord {
  id: string;
  referenceCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  companyName: string | null;
  workshopName: string | null;
  vehicleDetails: string | null;
  requestedItems: unknown;
  message: string;
  status: IntakeStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInquiryRecord {
  id: string;
  referenceCode: string;
  productId: string | null;
  productSku: string | null;
  productName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  companyName: string | null;
  quantity: number | null;
  message: string;
  status: IntakeStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerUpload {
  id: string;
  originalFileName: string;
  byteSize: number;
  sha256: string;
  status: BinUploadStatus;
  productContext: string | null;
  notes: string | null;
  rejectionReason: string | null;
  quoteRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  analysisJobs: Array<{
    id: string;
    status: string;
    stage: string;
    progress: number;
    attempts: number;
    maxAttempts: number;
    errorCode: string | null;
    errorMessage: string | null;
    queuedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
  }>;
}

export interface AccountInquiries {
  quoteRequests: QuoteRequestRecord[];
  productInquiries: ProductInquiryRecord[];
}

export interface AccountSummary {
  user: CustomerUser;
  counts: {
    orders: number;
    quoteRequests: number;
    productInquiries: number;
    uploads: number;
  };
  recent: {
    orders: CustomerOrder[];
    quoteRequests: QuoteRequestRecord[];
    productInquiries: ProductInquiryRecord[];
    uploads: CustomerUpload[];
  };
}
