export type ReviewStatusFilter = 'open' | 'resolved' | 'all';

export interface AdminReviewCandidate {
  id: string;
  rawProductId: string;
  suggestedProductId: string | null;
  confidence: number | null;
  priority: number;
  createdAt: string;
  rawProduct: {
    vendorSlug: string;
    vendorUrl: string;
    vendorSku: string | null;
    rawName: string;
    fingerprint: string | null;
  };
  suggestedProduct: {
    id: string;
    slug: string;
    name: string;
    status: string;
  } | null;
}

export interface AdminReviewQueueItem {
  id: string;
  rawProductId: string;
  suggestedProductId: string | null;
  suggestedConfidence: number | null;
  priority: number;
  assignedTo: unknown;
  resolvedAt: string | null;
  resolvedBy: unknown;
  resolvedAction: string | null;
  notes: string | null;
  createdAt: string;
  rawProduct: {
    id: string;
    vendorId: string;
    vendorSlug: string;
    vendorName: string;
    ingestionRunId: string;
    vendorUrl: string;
    vendorSku: string | null;
    rawName: string;
    rawDescription: string | null;
    rawPriceText: string | null;
    parsedPriceCents: string | null;
    parsedCurrency: string | null;
    parsedInStock: boolean | null;
    rawSpecs: unknown;
    rawImageUrls: unknown;
    fingerprint: string | null;
    matchStatus: string;
    matchConfidence: number | null;
    scrapedAt: string;
  };
  suggestedProduct: {
    id: string;
    publicId: string;
    slug: string;
    name: string;
    status: string;
    fingerprint: string | null;
  } | null;
}

export interface AdminReviewDashboard {
  pendingReviewCount: number;
  highConfidenceCandidates: AdminReviewCandidate[];
  lowConfidenceCandidates: AdminReviewCandidate[];
  duplicateCandidates: Array<{
    vendorId: string;
    vendorSlug: string;
    duplicateKey: string;
    duplicateCount: number;
    rawProductIds: string[];
  }>;
  unresolvedProducts: Array<{
    id: string;
    vendorSlug: string;
    vendorUrl: string;
    vendorSku: string | null;
    rawName: string;
    fingerprint: string | null;
    scrapedAt: string;
  }>;
  ingestionFailureQueue: Array<{
    id: string;
    vendorSlug: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    productsFound: number;
    errors: string[];
  }>;
}

export interface ImageIntegrityReport {
  duplicateImageDetection: Array<{
    contentHash: string;
    imageCount: number;
    rawImageIds: string[];
  }>;
  brokenImageDetection: Array<{
    id: string;
    rawProductId: string;
    vendorSlug: string;
    originalUrl: string;
    storageKey: string | null;
    downloadError: string | null;
  }>;
  missingImageDetection: {
    masterProducts: Array<{
      id: string;
      slug: string;
      name: string;
      status: string;
    }>;
    rawProducts: Array<{
      rawProductId: string;
      vendorSlug: string;
      vendorUrl: string;
      rawImageUrlCount: number;
    }>;
  };
  imageHashComparison: Array<{
    contentHash: string;
    rawImageIds: string[];
  }>;
  localAssetVerification: Array<{
    rawImageId: string;
    contentHash: string | null;
    expectedBytes: string | number | null;
    exists: boolean;
    bytes?: number | null;
    reason?: string;
  }>;
}

export interface PricingWorkflow {
  product: {
    id: string;
    slug: string;
    name: string;
    status: string;
  };
  currentLowestVendor: {
    offerId: string;
    vendorId: string;
    vendorSlug: string;
    vendorName: string;
    priceCents: string | null;
    currency: string;
    inStock: boolean | null;
  } | null;
  adminSelectedCuratedPrice: {
    id: string;
    selectedOfferId: string | null;
    priceCents: string;
    currency: string;
    reason: string | null;
    selectedAt: string;
    selectedBy: unknown;
    selectedVendorSlug: string | null;
  } | null;
  vendorPriceHistoryTimeline: Array<{
    offerId: string;
    vendorId: string;
    vendorSlug: string;
    vendorName: string;
    vendorSku: string | null;
    vendorUrl: string;
    currentPriceCents: string | null;
    currency: string;
    status: string;
    inStock: boolean | null;
    history: Array<{
      id: string;
      priceCents: string;
      currency: string;
      inStock: boolean | null;
      observedAt: string;
    }>;
  }>;
  priceAnomalyDetection: Array<{
    offerId: string;
    vendorSlug: string;
    type: string;
    details: string;
  }>;
}

export interface IngestionObservability {
  ingestionSuccessRate: {
    windowSize: number;
    completed: number;
    failedOrPartial: number;
    rate: number;
  };
  retryCount: number;
  failureCategories: Array<{ category: string; count: number }>;
  queueBacklog: unknown;
  processingLatency: {
    averageMs: number | null;
    samples: number;
  };
  recentRuns: Array<{
    id: string;
    vendorSlug: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    latencyMs: number | null;
    productsFound: number;
    errorCount: number;
  }>;
}

export interface ReconciliationReport {
  projectionConsistencyDashboard: Array<{
    issue: string;
    publicId: string;
    slug: string;
  }>;
  postgresqlVsSearchMismatchReport: unknown;
  unpublishedOrphanScan: Array<{
    productId: string;
    slug: string;
    status: string;
    activeOfferCount: number;
  }>;
  vendorOfferIntegrityScan: Array<{
    issue: string;
    offerId: string;
    productId: string;
    vendorId: string;
    vendorUrl: string;
  }>;
}

export interface AdminAuditRecord {
  id: string;
  user: unknown;
  entityType: string;
  entityId: string;
  action: string;
  diff: unknown;
  requestId: string | null;
  occurredAt: string;
}

export interface ReviewCreateMasterInput {
  slug: string;
  sku?: string | null;
  mpn?: string | null;
  name: string;
  shortDescription?: string | null;
  longDescriptionMd?: string | null;
  manufacturerId?: string;
  manufacturerSlug: string;
  manufacturerName: string;
  categoryId: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'ARCHIVED';
  fingerprint: string;
  featured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  createOffer?: boolean;
  notes?: string | null;
}
