/**
 * Admin-facing record shapes.
 *
 * These types describe responses expected from GET/POST/PATCH/DELETE endpoints
 * under /api/admin/. Shapes mirror Prisma select objects that will be used when
 * those routes are implemented.
 *
 * Keep in sync with: apps/api/src/routes/admin/  (to be created)
 */

import type { BinUploadStatus, IntakeStatus, StorageProvider } from './types';
import type {
  InventoryStatus,
  ProductStatus,
  CategoryRef,
  ProductImage,
} from './catalog-types';

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface ListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Admin product types ──────────────────────────────────────────────────────

export interface AdminProductListItem {
  id: string;
  sku: string | null;
  slug: string;
  name: string;
  status: ProductStatus;
  inventoryStatus: InventoryStatus;
  quantityOnHand: number;
  priceCents: number | null;
  tradePriceCents: number | null;
  tradeOnly: boolean;
  featured: boolean;
  b2bEligible: boolean;
  categoryId: string | null;
  categoryName: string | null;
  supplierName: string | null;
  imageCount: number;
  primaryImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductDetail {
  id: string;
  sku: string | null;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  status: ProductStatus;
  categoryId: string | null;
  category: CategoryRef | null;
  supplierId: string | null;
  supplierName: string | null;
  priceCents: number | null;
  currency: string;
  tradePriceCents: number | null;
  tradeOnly: boolean;
  featured: boolean;
  b2bEligible: boolean;
  inventoryStatus: InventoryStatus;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number | null;
  images: ProductImage[];
  attributes: unknown;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductInput {
  name: string;
  slug?: string;
  sku?: string;
  shortDescription?: string;
  description?: string;
  status: ProductStatus;
  categoryId?: string;
  supplierId?: string;
  priceCents?: number;
  currency?: string;
  tradePriceCents?: number;
  tradeOnly?: boolean;
  featured?: boolean;
  b2bEligible?: boolean;
  attributes?: Record<string, unknown>;
}

// ─── Admin inventory types ────────────────────────────────────────────────────

export interface AdminInventoryItem {
  productId: string;
  productName: string;
  sku: string | null;
  slug: string;
  status: InventoryStatus;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderPoint: number | null;
  primaryImageUrl: string | null;
  updatedAt: string;
}

export interface AdminInventoryUpdate {
  status?: InventoryStatus;
  quantityOnHand?: number;
  reorderPoint?: number;
}

// ─── Admin article types ──────────────────────────────────────────────────────

export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface AdminArticleListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: ArticleStatus;
  category: string | null;
  coverImageUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminArticleDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  status: ArticleStatus;
  category: string | null;
  tags: string[];
  coverImageUrl: string | null;
  author: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminArticleInput {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  status: ArticleStatus;
  category?: string;
  tags?: string[];
  coverImageUrl?: string;
  author?: string;
  seoTitle?: string;
  seoDescription?: string;
}

// ─── Dashboard metrics ────────────────────────────────────────────────────────

export interface AdminDashboardMetrics {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  totalArticles: number;
  publishedArticles: number;
  newInquiries: number;
  pendingUploads: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}

// ─── Auth types ───────────────────────────────────────────────────────────────

export interface AdminLoginInput {
  email: string;
  password: string;
}

export interface AdminSession {
  token: string;
  userId: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  expiresAt: string;
}

// ─── Quote request records ────────────────────────────────────────────────────

export interface QuoteRequestRecord {
  id: string;
  referenceCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  companyName?: string;
  workshopName?: string;
  vehicleDetails?: string;
  requestedItems: string[];
  message: string;
  source: string;
  status: IntakeStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Product inquiry records ──────────────────────────────────────────────────

export interface ProductInquiryRecord {
  id: string;
  referenceCode: string;
  productId?: string;
  productSku?: string;
  productName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  companyName?: string;
  quantity?: number;
  message: string;
  source: string;
  status: IntakeStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Workshop lead records ────────────────────────────────────────────────────

export interface WorkshopLeadRecord {
  id: string;
  referenceCode: string;
  workshopName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  location?: string;
  monthlyVolume?: number;
  serviceInterests: string[];
  preferredTimeline?: string;
  message: string;
  source: string;
  status: IntakeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeRow {
  id: string;
  referenceCode: string;
  type: 'quote_request' | 'product_inquiry' | 'workshop_consultation';
  contact: string;
  email: string;
  subject: string;
  status: IntakeStatus;
  source: string;
  createdAt: string;
}

export interface RequestQueueRow {
  id: string;
  referenceCode: string;
  type: 'quote_request' | 'product_inquiry';
  customerName: string;
  customerEmail: string;
  subject: string;
  status: IntakeStatus;
  source: string;
  createdAt: string;
}

// ─── Bin upload records ───────────────────────────────────────────────────────

export interface BinUploadRecord {
  id: string;
  originalFileName: string;
  storedObjectKey: string;
  storageProvider: StorageProvider;
  byteSize: number;
  sha256: string;
  status: BinUploadStatus;
  requesterName?: string;
  requesterEmail?: string;
  productContext?: string;
  notes?: string;
  quoteRequestId?: string;
  createdAt: string;
}

// ─── Audit log records ────────────────────────────────────────────────────────

export interface AuditLogRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
