import { z } from 'zod';

const slug = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const bigIntId = z.string().trim().regex(/^\d+$/);
const optionalText = (max = 1000) => z.string().trim().min(1).max(max).nullable().optional();
const requiredText = (max = 1000) => z.string().trim().min(1).max(max);
const optionalReason = z.string().trim().min(1).max(1000).optional();
const catalogProductStatus = z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED']);
const offerStatus = z.enum(['ACTIVE', 'PAUSED', 'DISCONTINUED']);

export const masterProductListQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: catalogProductStatus.optional(),
  cursor: bigIntId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const masterProductCreateSchema = z.object({
  slug,
  sku: optionalText(120),
  mpn: optionalText(180),
  name: requiredText(240),
  shortDescription: optionalText(500),
  longDescriptionMd: optionalText(20000),
  manufacturerId: bigIntId.optional(),
  manufacturerSlug: requiredText(180),
  manufacturerName: requiredText(240),
  categoryId: bigIntId,
  status: catalogProductStatus.default('DRAFT'),
  fingerprint: requiredText(240),
  featured: z.coerce.boolean().default(false),
  seoTitle: optionalText(240),
  seoDescription: optionalText(360),
});

export const masterProductUpdateSchema = masterProductCreateSchema.partial().extend({
  slug: slug.optional(),
  categoryId: bigIntId.optional(),
  manufacturerId: bigIntId.nullable().optional(),
  status: catalogProductStatus.optional(),
});

export const masterProductPublishSchema = z
  .object({
    reason: optionalReason,
  })
  .default({});

export const masterProductArchiveSchema = z.object({
  reason: optionalReason,
});

export const vendorOfferCreateSchema = z.object({
  vendorId: bigIntId,
  vendorSku: optionalText(180),
  vendorUrl: z.string().trim().url().max(2000),
  priceCents: z.coerce.bigint().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  inStock: z.coerce.boolean().nullable().optional(),
  lastSeenAt: z.coerce.date().optional(),
  status: offerStatus.default('ACTIVE'),
  confidence: z.coerce.number().min(0).max(1).default(1),
  notes: optionalText(2000),
});

export const vendorOfferUpdateSchema = vendorOfferCreateSchema.partial().extend({
  vendorId: bigIntId.optional(),
});

export const catalogProductImageCreateSchema = z.object({
  storageKey: requiredText(2000),
  width: z.coerce.number().int().positive().nullable().optional(),
  height: z.coerce.number().int().positive().nullable().optional(),
  mimeType: optionalText(120),
  altText: optionalText(240),
  isPrimary: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
  sourceVendorId: bigIntId.nullable().optional(),
});

export const catalogProductImageUpdateSchema = catalogProductImageCreateSchema.partial();

export const reviewQueueListQuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'all']).default('open'),
  cursor: bigIntId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const reviewQueueAttachSchema = z.object({
  masterProductId: bigIntId,
  confidence: z.coerce.number().min(0).max(1).optional(),
  notes: optionalText(2000),
});

export const reviewQueueCreateSchema = masterProductCreateSchema
  .omit({ fingerprint: true })
  .extend({
    createOffer: z.coerce.boolean().default(true),
    notes: optionalText(2000),
  });

export const reviewQueueRejectSchema = z.object({
  reason: requiredText(2000),
});

export const reviewQueueApproveSchema = z.object({
  masterProductId: bigIntId.optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
  notes: optionalText(2000),
});

export const reviewQueueMergeDuplicateSchema = z.object({
  canonicalRawProductId: bigIntId,
  reason: requiredText(2000),
});

export const reviewQueueArchiveSchema = z.object({
  reason: requiredText(2000),
});

export const reviewQueueRefingerprintSchema = z
  .object({
    reason: optionalReason,
  })
  .default({});

export type MasterProductListQuery = z.infer<typeof masterProductListQuerySchema>;
export type MasterProductCreateInput = z.infer<typeof masterProductCreateSchema>;
export type MasterProductUpdateInput = z.infer<typeof masterProductUpdateSchema>;
export type MasterProductPublishInput = z.infer<typeof masterProductPublishSchema>;
export type MasterProductArchiveInput = z.infer<typeof masterProductArchiveSchema>;
export type VendorOfferCreateInput = z.infer<typeof vendorOfferCreateSchema>;
export type VendorOfferUpdateInput = z.infer<typeof vendorOfferUpdateSchema>;
export type CatalogProductImageCreateInput = z.infer<typeof catalogProductImageCreateSchema>;
export type CatalogProductImageUpdateInput = z.infer<typeof catalogProductImageUpdateSchema>;
export type ReviewQueueListQuery = z.infer<typeof reviewQueueListQuerySchema>;
export type ReviewQueueAttachInput = z.infer<typeof reviewQueueAttachSchema>;
export type ReviewQueueCreateInput = z.infer<typeof reviewQueueCreateSchema>;
export type ReviewQueueRejectInput = z.infer<typeof reviewQueueRejectSchema>;
export type ReviewQueueApproveInput = z.infer<typeof reviewQueueApproveSchema>;
export type ReviewQueueMergeDuplicateInput = z.infer<typeof reviewQueueMergeDuplicateSchema>;
export type ReviewQueueArchiveInput = z.infer<typeof reviewQueueArchiveSchema>;
export type ReviewQueueRefingerprintInput = z.infer<typeof reviewQueueRefingerprintSchema>;
