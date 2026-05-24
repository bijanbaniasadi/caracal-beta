import { z } from 'zod';

const optionalText = (max = 500) => z.string().trim().min(1).max(max).optional();
const requiredText = (max = 2000) => z.string().trim().min(1).max(max);
const email = z.string().trim().email().max(254).toLowerCase();
const phone = z.string().trim().min(7).max(40).optional();
const optionalSku = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .transform((value) => value.toUpperCase())
  .optional();

export const quoteRequestSchema = z.object({
  customerName: requiredText(160),
  customerEmail: email,
  customerPhone: phone,
  companyName: optionalText(160),
  workshopName: optionalText(160),
  vehicleDetails: optionalText(500),
  requestedItems: z.array(z.string().trim().min(1).max(160)).max(25).optional(),
  message: requiredText(4000),
  source: z.string().trim().min(1).max(80).default('api'),
  metadata: z.record(z.unknown()).optional(),
});

export const productInquirySchema = z
  .object({
    productId: optionalText(120),
    productSku: optionalSku,
    productName: optionalText(200),
    customerName: requiredText(160),
    customerEmail: email,
    customerPhone: phone,
    companyName: optionalText(160),
    quantity: z.coerce.number().int().positive().max(100000).optional(),
    message: requiredText(3000),
    source: z.string().trim().min(1).max(80).default('api'),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((input, context) => {
    if (!input.productId && !input.productSku && !input.productName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productName'],
        message: 'Provide productName, productId, or productSku.',
      });
    }
  });

export const workshopConsultationLeadSchema = z.object({
  workshopName: requiredText(180),
  contactName: requiredText(160),
  contactEmail: email,
  contactPhone: phone,
  location: optionalText(240),
  monthlyVolume: z.coerce.number().int().nonnegative().max(100000).optional(),
  serviceInterests: z.array(z.string().trim().min(1).max(160)).max(30).optional(),
  preferredTimeline: optionalText(120),
  message: requiredText(4000),
  source: z.string().trim().min(1).max(80).default('api'),
  metadata: z.record(z.unknown()).optional(),
});

export const binUploadFieldsSchema = z.object({
  requesterName: optionalText(160),
  requesterEmail: email.optional(),
  productContext: optionalText(240),
  quoteRequestId: optionalText(120),
  notes: optionalText(1200),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
export type ProductInquiryInput = z.infer<typeof productInquirySchema>;
export type WorkshopConsultationLeadInput = z.infer<typeof workshopConsultationLeadSchema>;
export type BinUploadFieldsInput = z.infer<typeof binUploadFieldsSchema>;
