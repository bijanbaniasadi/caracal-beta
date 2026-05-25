import { z } from 'zod';

export const checkoutLineItemSchema = z
  .object({
    productId: z.string().trim().min(1).max(120).optional(),
    sku: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(240).optional(),
    quantity: z.coerce.number().int().min(1).max(25).default(1),
  })
  .refine((item) => item.productId || item.sku || item.slug, {
    message: 'Each checkout item needs productId, sku, or slug.',
  });

export const createStripeCheckoutSessionSchema = z.object({
  items: z.array(checkoutLineItemSchema).min(1).max(50),
  customerEmail: z.string().trim().email().max(254).optional(),
  successUrl: z.string().trim().url().max(1000).optional(),
  cancelUrl: z.string().trim().url().max(1000).optional(),
});

export type CreateStripeCheckoutSessionInput = z.infer<typeof createStripeCheckoutSessionSchema>;
