import { z } from 'zod';

const slug = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionalText = (max = 500) => z.string().trim().min(1).max(max).nullable().optional();
const requiredText = (max = 500) => z.string().trim().min(1).max(max);
const nullablePathOrUrl = z.string().trim().min(1).max(500).nullable().optional();
const jsonRecord = z.record(z.unknown());

function firstQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

const queryText = (max = 200) =>
  z.preprocess(firstQueryValue, z.string().trim().min(1).max(max)).optional();

const queryLimit = z
  .preprocess(firstQueryValue, z.coerce.number().int().min(1).max(100))
  .default(50);

const productStatus = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
const inventoryStatus = z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'DISCONTINUED']);
const articleStatus = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const intakeStatus = z.enum(['NEW', 'IN_REVIEW', 'RESPONDED', 'CLOSED', 'SPAM']);
const binUploadStatus = z.enum(['RECEIVED', 'VALIDATED', 'REJECTED', 'STORED']);

const imageInputSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  url: z.string().trim().min(1).max(500),
  altText: optionalText(240),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
  isPrimary: z.coerce.boolean().default(false),
  metadata: jsonRecord.optional(),
});

const inventoryInputSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  locationKey: z.string().trim().min(1).max(120).default('default'),
  locationLabel: optionalText(160),
  quantityOnHand: z.coerce.number().int().min(0).max(1000000).default(0),
  quantityReserved: z.coerce.number().int().min(0).max(1000000).default(0),
  reorderPoint: z.coerce.number().int().min(0).max(1000000).default(0),
  status: inventoryStatus.default('IN_STOCK'),
  metadata: jsonRecord.optional(),
});

export const adminListQuerySchema = z.object({
  q: queryText(200),
  status: queryText(80),
  cursor: queryText(120),
  limit: queryLimit,
});

export const productCreateSchema = z.object({
  sku: requiredText(120).transform((value) => value.toUpperCase()),
  slug,
  name: requiredText(240),
  shortDescription: optionalText(500),
  description: optionalText(8000),
  status: productStatus.default('DRAFT'),
  priceCents: z.coerce.number().int().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).default('AED'),
  categoryId: optionalText(120),
  supplierId: optionalText(120),
  isFeatured: z.coerce.boolean().default(false),
  isB2BEligible: z.coerce.boolean().default(false),
  isTradeOnly: z.coerce.boolean().default(false),
  tradePriceCents: z.coerce.number().int().nonnegative().nullable().optional(),
  attributes: jsonRecord.optional(),
  metadata: jsonRecord.optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  images: z.array(imageInputSchema).max(30).optional(),
  inventoryItems: z.array(inventoryInputSchema).max(25).optional(),
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  sku: requiredText(120)
    .transform((value) => value.toUpperCase())
    .optional(),
  slug: slug.optional(),
});

export const categoryCreateSchema = z.object({
  name: requiredText(180),
  slug,
  description: optionalText(1000),
  parentId: optionalText(120),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
  isActive: z.coerce.boolean().default(true),
  metadata: jsonRecord.optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  slug: slug.optional(),
});

export const articleCreateSchema = z.object({
  slug,
  title: requiredText(240),
  excerpt: optionalText(1000),
  contentHtml: optionalText(100000),
  status: articleStatus.default('DRAFT'),
  category: optionalText(160),
  coverImage: nullablePathOrUrl,
  thumbnailImage: nullablePathOrUrl,
  seoTitle: optionalText(240),
  seoDescription: optionalText(360),
  keywords: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  isFeatured: z.coerce.boolean().default(false),
  authorId: optionalText(120),
  metadata: jsonRecord.optional(),
  publishedAt: z.coerce.date().nullable().optional(),
});

export const articleUpdateSchema = articleCreateSchema.partial().extend({
  slug: slug.optional(),
});

export const uploadUpdateSchema = z.object({
  status: binUploadStatus.optional(),
  requesterName: optionalText(160),
  requesterEmail: z.string().trim().email().max(254).toLowerCase().nullable().optional(),
  productContext: optionalText(240),
  notes: optionalText(1200),
  rejectionReason: optionalText(1200),
  metadata: jsonRecord.optional(),
});

export const inquiryUpdateSchema = z.object({
  status: intakeStatus,
  metadata: jsonRecord.optional(),
});

export const inventoryUpdateSchema = z.object({
  locationKey: z.string().trim().min(1).max(120).optional(),
  locationLabel: optionalText(160),
  quantityOnHand: z.coerce.number().int().min(0).max(1000000).optional(),
  quantityReserved: z.coerce.number().int().min(0).max(1000000).optional(),
  reorderPoint: z.coerce.number().int().min(0).max(1000000).optional(),
  status: inventoryStatus.optional(),
  metadata: jsonRecord.optional(),
});

export const inventoryUpsertSchema = inventoryInputSchema;

export const binAnalysisEnqueueSchema = z
  .object({
    priority: z.coerce.number().int().min(0).max(100).optional(),
    force: z.coerce.boolean().default(false),
    metadata: jsonRecord.optional(),
  })
  .default({});

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;
export type UploadUpdateInput = z.infer<typeof uploadUpdateSchema>;
export type InquiryUpdateInput = z.infer<typeof inquiryUpdateSchema>;
export type InventoryUpdateInput = z.infer<typeof inventoryUpdateSchema>;
export type InventoryUpsertInput = z.infer<typeof inventoryUpsertSchema>;
export type BinAnalysisEnqueueInput = z.infer<typeof binAnalysisEnqueueSchema>;
