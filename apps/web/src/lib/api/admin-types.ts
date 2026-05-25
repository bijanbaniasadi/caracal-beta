/**
 * Admin-facing type contracts derived from the real backend routes in
 * apps/api/src/routes/admin.ts and apps/api/src/routes/auth.ts.
 *
 * Do NOT import from apps/api directly — this is a frontend-only copy.
 */

// ─── Shared enums ─────────────────────────────────────────────────────────────

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type InventoryStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'DISCONTINUED';
export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type IntakeStatus = 'NEW' | 'IN_REVIEW' | 'RESPONDED' | 'CLOSED' | 'SPAM';
export type BinUploadStatus = 'RECEIVED' | 'VALIDATED' | 'REJECTED' | 'STORED';
export type BinAnalysisJobStatus =
  | 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type OrderStatus =
  | 'PENDING_PAYMENT' | 'PAID' | 'FULFILLING' | 'FULFILLED' | 'CANCELLED'
  | 'PARTIALLY_REFUNDED' | 'REFUNDED';
export type PaymentProvider = 'STRIPE' | 'MANUAL';
export type PaymentStatus =
  | 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUND_PENDING'
  | 'PARTIALLY_REFUNDED' | 'REFUNDED';
export type FulfillmentStatus =
  | 'UNFULFILLED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type RefundStatus = 'NONE' | 'REQUESTED' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'FAILED';
export type UserRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';
export type WorkerStatus = 'ONLINE' | 'OFFLINE' | 'STALE';
export type StorageProvider = 'LOCAL' | 'R2';

// ─── Auth / Session ───────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
}

export interface AdminSession {
  accessToken: string;
  accessTokenExpiresAt: string; // ISO
  user: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  tokenType: 'Bearer';
  user: AuthUser;
}

// ─── Cursor pagination ────────────────────────────────────────────────────────

export interface CursorPage<T> {
  items: T[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export interface AdminListQuery {
  q?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

// ─── Dashboard metrics ────────────────────────────────────────────────────────

export interface DashboardMetrics {
  users: number;
  products: Partial<Record<ProductStatus, number>>;
  articles: Partial<Record<ArticleStatus, number>>;
  inquiries: {
    quoteRequests: Partial<Record<IntakeStatus, number>>;
    productInquiries: Partial<Record<IntakeStatus, number>>;
    workshopConsultations: Partial<Record<IntakeStatus, number>>;
  };
  orders: {
    byStatus: Partial<Record<OrderStatus, number>>;
    byPaymentStatus: Partial<Record<PaymentStatus, number>>;
    byFulfillmentStatus: Partial<Record<FulfillmentStatus, number>>;
  };
  uploads: Partial<Record<BinUploadStatus, number>>;
  inventory: Partial<Record<InventoryStatus, number>>;
  binAnalysis: Partial<Record<BinAnalysisJobStatus, number>>;
  recentAuditLogs: AuditLogRecord[];
}

// ─── Products ─────────────────────────────────────────────────────────────────

export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  locationKey: string;
  locationLabel: string | null;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
  status: InventoryStatus;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySummary {
  status: InventoryStatus;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderPoint: number;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface SupplierRef {
  id: string;
  name: string;
  slug: string;
}

export interface AdminProduct {
  id: string;
  sku: string | null;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  status: ProductStatus;
  priceCents: number | null;
  currency: string;
  tradePriceCents: number | null;
  category: CategoryRef | null;
  supplier: SupplierRef | null;
  isFeatured: boolean;
  isB2BEligible: boolean;
  isTradeOnly: boolean;
  attributes: unknown;
  metadata: unknown;
  images: ProductImage[];
  inventory: {
    summary: InventorySummary;
    items: InventoryItem[];
  };
  counts: { cartItems: number; inquiries: number };
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCreateInput {
  sku: string;
  slug: string;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  status?: ProductStatus;
  priceCents?: number | null;
  currency?: string;
  categoryId?: string | null;
  supplierId?: string | null;
  isFeatured?: boolean;
  isB2BEligible?: boolean;
  isTradeOnly?: boolean;
  tradePriceCents?: number | null;
  attributes?: Record<string, unknown>;
  publishedAt?: string | null;
  images?: Array<{
    url: string;
    altText?: string | null;
    sortOrder?: number;
    isPrimary?: boolean;
  }>;
  inventoryItems?: Array<{
    locationKey?: string;
    locationLabel?: string | null;
    quantityOnHand?: number;
    quantityReserved?: number;
    reorderPoint?: number;
    status?: InventoryStatus;
  }>;
}

export type ProductUpdateInput = Partial<ProductCreateInput>;

// ─── Categories ───────────────────────────────────────────────────────────────

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parent: CategoryRef | null;
  children: Array<CategoryRef & { isActive: boolean; sortOrder: number }>;
  sortOrder: number;
  isActive: boolean;
  metadata: unknown;
  _count: { children: number; products: number };
  createdAt: string;
  updatedAt: string;
}

// ─── Articles ─────────────────────────────────────────────────────────────────

export interface AdminArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentHtml: string | null;
  status: ArticleStatus;
  category: string | null;
  coverImage: string | null;
  thumbnailImage: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  keywords: string[];
  isFeatured: boolean;
  author: { id: string; email: string; name: string | null; role: UserRole } | null;
  metadata: unknown;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleCreateInput {
  slug: string;
  title: string;
  excerpt?: string | null;
  contentHtml?: string | null;
  status?: ArticleStatus;
  category?: string | null;
  coverImage?: string | null;
  thumbnailImage?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  keywords?: string[];
  isFeatured?: boolean;
  authorId?: string | null;
  publishedAt?: string | null;
}

export type ArticleUpdateInput = Partial<ArticleCreateInput>;

// Orders

export interface AdminOrderItem {
  id: string;
  productId: string | null;
  sku: string | null;
  slug: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  currency: string;
  product: {
    id: string;
    sku: string | null;
    slug: string;
    name: string;
    status: ProductStatus;
  } | null;
}

export interface AdminOrderPayment {
  id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amountCents: number;
  refundedCents: number;
  currency: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeRefundId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  paidAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  user: { id: string; email: string; name: string | null; role: UserRole } | null;
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
  refundStatus: RefundStatus;
  stripe: {
    checkoutSessionId: string | null;
    paymentIntentId: string | null;
    customerId: string | null;
    paymentStatus: string | null;
  };
  checkoutExpiresAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  shippingTracking: string | null;
  adminNotes: string | null;
  metadata: unknown;
  items: AdminOrderItem[];
  payments: AdminOrderPayment[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderUpdateInput {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  refundStatus?: RefundStatus;
  shippingTracking?: string | null;
  adminNotes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface OrderRefundInput {
  amountCents?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

// ─── BIN Uploads ──────────────────────────────────────────────────────────────

export interface BinAnalysisResult {
  id: string;
  jobId: string;
  resultType: string;
  confidence: number;
  data: unknown;
  metadata: unknown;
  createdAt: string;
}

export interface BinAnalysisJob {
  id: string;
  uploadId: string;
  status: BinAnalysisJobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  upload?: BinUploadSummary;
  results?: BinAnalysisResult[];
}

export interface BinUploadSummary {
  id: string;
  originalFileName: string;
  storedObjectKey: string;
  byteSize: number;
  sha256: string;
  status: BinUploadStatus;
  createdAt: string;
}

export interface AdminBinUpload {
  id: string;
  originalFileName: string;
  storedObjectKey: string;
  storageProvider: StorageProvider;
  byteSize: number;
  sha256: string;
  status: BinUploadStatus;
  requesterName: string | null;
  requesterEmail: string | null;
  productContext: string | null;
  notes: string | null;
  rejectionReason: string | null;
  metadata: unknown;
  quoteRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  quoteRequest?: {
    id: string;
    referenceCode: string;
    customerName: string;
    customerEmail: string;
    status: IntakeStatus;
  } | null;
  analysisJobs?: BinAnalysisJob[];
}

// ─── Inquiries ────────────────────────────────────────────────────────────────

export interface QuoteRequest {
  id: string;
  referenceCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  companyName: string | null;
  workshopName: string | null;
  vehicleDetails: string | null;
  requestedItems: string[];
  message: string;
  source: string;
  status: IntakeStatus;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  binUploads?: BinUploadSummary[];
}

export interface ProductInquiry {
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
  source: string;
  status: IntakeStatus;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  product?: { id: string; sku: string | null; slug: string; name: string } | null;
}

export interface WorkshopConsultation {
  id: string;
  referenceCode: string;
  workshopName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  location: string | null;
  monthlyVolume: number | null;
  serviceInterests: string[];
  preferredTimeline: string | null;
  message: string;
  source: string;
  status: IntakeStatus;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface InquiriesResponse {
  quoteRequests: QuoteRequest[];
  productInquiries: ProductInquiry[];
  workshopConsultations: WorkshopConsultation[];
}

// ─── Queue / Worker ───────────────────────────────────────────────────────────

export interface QueueJobCounts {
  waiting?: number;
  active?: number;
  completed?: number;
  failed?: number;
  delayed?: number;
  paused?: number;
  prioritized?: number;
  'waiting-children'?: number;
}

export interface BinAnalysisQueueStats {
  queueName: string;
  isPaused: boolean;
  counts: QueueJobCounts;
  settings: {
    concurrency: number;
    maxAttempts: number;
    retryBackoffMs: number;
    stalledAfterMs: number;
  };
}

export interface EcuCorpusQueueStageStats {
  queueName: string;
  stage: string;
  isPaused: boolean;
  counts: QueueJobCounts;
}

export interface EcuCorpusQueuesStats {
  stages: EcuCorpusQueueStageStats[];
}

export interface WorkerHeartbeat {
  id: string;
  workerId: string;
  queueName: string;
  status: WorkerStatus;
  isStale: boolean;
  effectiveStatus: WorkerStatus | 'STALE';
  metadata: unknown;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueueHealthResponse {
  queue: BinAnalysisQueueStats;
  ecuCorpusQueues: EcuCorpusQueuesStats;
  workers: WorkerHeartbeat[];
  heartbeat: { staleAfterMs: number };
}

// ─── ECU Corpus ───────────────────────────────────────────────────────────────

export interface EcuCorpusFingerprint {
  architecture: string | null;
  supplier: string | null;
  probableOem: string | null;
  controllerType: string | null;
  fuelType: string | null;
  softwareVersion: string | null;
  hardwareNumber: string | null;
}

export interface EcuDetectedFamily {
  id: string;
  familyKey: string;
  familyLabel: string | null;
  oem: string | null;
  confidence: number;
}

export interface EcuCorpusFile {
  id: string;
  fileName: string;
  relativePath: string;
  fullPath: string;
  extension: string;
  sizeBytes: string; // BigInt serialised as string
  sha256: string;
  detectedKind: string | null;
  indexedAt: string;
  fingerprint: EcuCorpusFingerprint | null;
  detectedFamilies: EcuDetectedFamily[];
  _count: { projectLabels: number; mapDefinitions: number; clusterMemberships: number };
}

export interface EcuLearnedSignature {
  id: string;
  signatureKey: string;
  signatureType: string;
  label: string | null;
  confidence: number;
  runId: string;
  cluster: {
    id: string;
    label: string | null;
    clusterType: string | null;
    familyKey: string | null;
    memberCount: number;
  } | null;
  createdAt: string;
}

export interface EcuFileCluster {
  id: string;
  clusterKey: string;
  label: string | null;
  clusterType: string | null;
  familyKey: string | null;
  memberCount: number;
  confidence: number;
  runId: string;
  signatures: EcuLearnedSignature[];
  unknown?: EcuUnknownFamily | null;
}

export interface EcuUnknownFamily {
  id: string;
  unknownKey: string;
  label: string | null;
  memberCount: number;
  confidence: number;
  runId: string;
  cluster?: Omit<EcuFileCluster, 'unknown'> | null;
}

export interface EcuAnalysisRun {
  id: string;
  status: string;
  rootPath: string | null;
  totalFiles: number | null;
  processedFiles: number | null;
  failedFiles: number | null;
  skippedFiles: number | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  metadata: unknown;
  updatedAt: string;
}

export interface EcuOriModPair {
  id: string;
  runId: string;
  confidence: number;
  originalFile: { id: string; relativePath: string; fileName: string; sha256: string; sizeBytes: string };
  modifiedFile: { id: string; relativePath: string; fileName: string; sha256: string; sizeBytes: string };
}

export interface CorpusMetrics {
  totalFiles: number;
  totalClusters: number;
  totalSignatures: number;
  totalUnknownFamilies: number;
  filesByKind: Record<string, number>;
  filesByExtension: Record<string, number>;
  stageProgress: Record<string, { processed: number; failed: number; pending: number }>;
}

// ─── ECU Corpus detail types (Phase 2 intelligence UI) ───────────────────────

export interface EcuBinaryFingerprintFull {
  id: string;
  fileId: string;
  entropy: number | null;
  entropyProfile: unknown;
  architecture: string | null;
  supplier: string | null;
  probableOem: string | null;
  controllerType: string | null;
  fuelType: string | null;
  softwareVersion: string | null;
  hardwareNumber: string | null;
  filenameTokens: unknown;
  stringTable: unknown;
  byteSignatures: unknown;
  vectorPatterns: unknown;
  /** JSON array of { offset, length, type, confidence } */
  calibrationRegions: unknown;
  mapBlockCandidates: unknown;
  checksumCandidates: unknown;
  dtcCandidates: unknown;
  intelligenceSummary: unknown;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface EcuMapRegion {
  id: string;
  fileId: string;
  mapDefinitionId: string | null;
  /** BigInt serialised as string */
  offset: string | null;
  length: number | null;
  regionType: string;
  confidence: number;
}

export interface EcuMapDefinitionFull {
  id: string;
  fileId: string;
  labelId: string | null;
  name: string;
  /** BigInt serialised as string */
  address: string | null;
  dataType: string | null;
  axes: unknown;
  factor: number | null;
  offset: number | null;
  unit: string | null;
  comments: string | null;
  regions: EcuMapRegion[];
  createdAt: string;
  updatedAt: string;
}

export interface EcuProjectLabel {
  id: string;
  fileId: string;
  labelType: string;
  name: string;
  /** BigInt serialised as string */
  address: string | null;
  dataType: string | null;
  unit: string | null;
  factor: number | null;
  offset: number | null;
  source: string | null;
  confidence: number;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EcuChecksumCandidate {
  id: string;
  fileId: string;
  family: string;
  /** BigInt serialised as string */
  offset: string | null;
  length: number | null;
  confidence: number;
  createdAt: string;
}

export interface EcuDtcCandidate {
  id: string;
  fileId: string;
  encoding: string;
  confidence: number;
  /** JSON array of sample DTC codes */
  sampleCodes: unknown;
  createdAt: string;
}

export interface EcuClusterMembership {
  id: string;
  clusterId: string;
  fileId: string;
  score: number;
  cluster: {
    id: string;
    label: string | null;
    clusterKey: string;
    familyKey: string | null;
    clusterType: string | null;
    confidence: number;
  };
}

export interface EcuCorpusFileFull {
  id: string;
  fileName: string;
  relativePath: string;
  fullPath: string;
  extension: string;
  /** BigInt serialised as string */
  sizeBytes: string;
  sha256: string;
  detectedKind: string | null;
  indexedAt: string;
  fingerprint: EcuBinaryFingerprintFull | null;
  detectedFamilies: EcuDetectedFamily[];
  projectLabels: EcuProjectLabel[];
  mapDefinitions: EcuMapDefinitionFull[];
  checksumCandidates: EcuChecksumCandidate[];
  dtcCandidates: EcuDtcCandidate[];
  clusterMemberships: EcuClusterMembership[];
  _count: { projectLabels: number; mapDefinitions: number; clusterMemberships: number };
}

export interface EcuModificationSignature {
  id: string;
  runId: string;
  clusterId: string | null;
  pairId: string | null;
  signatureType: string;
  signatureKey: string;
  confidence: number;
  regions: unknown;
  evidence: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface EcuOriModPairFull {
  id: string;
  runId: string;
  confidence: number;
  /** BigInt serialised as string */
  sizeBytes: string;
  shaDistance: number | null;
  /** JSON array of changed regions */
  changedRegions: unknown;
  probableModificationType: string | null;
  changedMapCandidates: unknown;
  originalFile: {
    id: string;
    fileName: string;
    relativePath: string;
    sha256: string;
    sizeBytes: string;
    detectedKind: string | null;
  };
  modifiedFile: {
    id: string;
    fileName: string;
    relativePath: string;
    sha256: string;
    sizeBytes: string;
    detectedKind: string | null;
  };
  modificationSignatures: EcuModificationSignature[];
  createdAt: string;
  updatedAt: string;
}

export interface CorpusMatchResult {
  upload: { id: string; originalFileName: string; byteSize: number; sha256: string };
  exactMatches: EcuCorpusFile[];
  sameSizeMatches: EcuCorpusFile[];
  possibleMatchingLabels: (string | null)[];
  recommendedNextManualReviewStep: string;
}

export interface BinUploadUpdateInput {
  status?: BinUploadStatus;
  notes?: string | null;
  rejectionReason?: string | null;
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export interface AuditLogRecord {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  requestId: string | null;
  createdAt: string;
}

// ─── Inventory admin ──────────────────────────────────────────────────────────

export interface AdminInventoryItemFull extends InventoryItem {
  product: {
    id: string;
    sku: string | null;
    slug: string;
    name: string;
    status: ProductStatus;
  };
}

// ─── Frontend pagination types ────────────────────────────────────────────────

export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  refundStatus?: string;
}

// ─── Frontend type aliases ────────────────────────────────────────────────────
// Alias the canonical backend types for backward-compat with existing hooks/UI.

export type AdminLoginInput = LoginInput;
export type AdminDashboardMetrics = DashboardMetrics;
export type AdminProductListItem = AdminProduct;
export type AdminProductDetail = AdminProduct;
export type AdminProductInput = ProductCreateInput;
export type AdminArticleListItem = AdminArticle;
export type AdminArticleDetail = AdminArticle;
export type AdminArticleInput = ArticleCreateInput;
export type AdminOrderListItem = AdminOrder;
export type AdminOrderDetail = AdminOrder;
export type BinUploadRecord = AdminBinUpload;
export type QuoteRequestRecord = QuoteRequest;
export type WorkshopLeadRecord = WorkshopConsultation;
export type ProductInquiryRecord = ProductInquiry;

// ─── IntakeRow (normalised view for the combined inquiries table) ─────────────

export type IntakeRowType =
  | 'quote_request'
  | 'product_inquiry'
  | 'workshop_consultation';

export interface IntakeRow {
  id: string;
  type: IntakeRowType;
  referenceCode: string;
  contact: string;
  email: string;
  subject: string;
  status: IntakeStatus;
  source: string;
  createdAt: string;
}

// ─── AdminInventoryItem (flattened for the inventory editor) ──────────────────

export interface AdminInventoryItem {
  /** Inventory item's own ID — used for PATCH /api/admin/inventory/:id */
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  status: InventoryStatus;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderPoint: number | null;
  locationKey: string;
}

export interface AdminInventoryUpdate {
  status?: InventoryStatus;
  quantityOnHand?: number;
  quantityReserved?: number;
  reorderPoint?: number;
}

// ─── RequestQueueRow (backward-compat stub) ───────────────────────────────────

export interface RequestQueueRow {
  id: string;
  type: IntakeRowType;
  referenceCode: string;
  status: IntakeStatus;
  customerName: string;
  createdAt: string;
}
