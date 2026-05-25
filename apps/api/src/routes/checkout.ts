import { getPrismaClient } from '@caracal/db';
import type { Prisma, ProductStatus } from '@prisma/client';
import { Router, type Router as ExpressRouter } from 'express';
import Stripe from 'stripe';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import {
  createStripeCheckoutSessionSchema,
  type CreateStripeCheckoutSessionInput,
} from '../schemas/checkout.js';

export const checkoutRouter: ExpressRouter = Router();

const productInclude = {
  images: {
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    select: {
      url: true,
      isPrimary: true,
    },
  },
  inventoryItems: {
    select: {
      quantityOnHand: true,
      quantityReserved: true,
      status: true,
    },
  },
} satisfies Prisma.ProductInclude;

type CheckoutProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type StripeCheckoutSessionCreateParams = NonNullable<
  Parameters<Stripe['checkout']['sessions']['create']>[0]
>;
type StripeCheckoutLineItem = NonNullable<StripeCheckoutSessionCreateParams['line_items']>[number];
type StripeShippingOption = NonNullable<StripeCheckoutSessionCreateParams['shipping_options']>[number];

function getSiteUrl(): string {
  return (
    process.env.PUBLIC_SITE_URL ??
    process.env.WEB_URL ??
    process.env.APP_BASE_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new AppError(
      'payment_unconfigured',
      'Stripe checkout is not configured. Please contact us for invoice or bank transfer.',
      503
    );
  }

  return new Stripe(secretKey, {
    appInfo: {
      name: 'Caracal Tech Motors',
      version: '1.0.0',
    },
  });
}

function buildProductWhere(items: CreateStripeCheckoutSessionInput['items']) {
  const or: Prisma.ProductWhereInput[] = [];

  for (const item of items) {
    if (item.productId) or.push({ id: item.productId });
    if (item.sku) or.push({ sku: item.sku.toUpperCase() });
    if (item.slug) or.push({ slug: item.slug });
  }

  return { OR: or };
}

function productKey(product: CheckoutProduct): string[] {
  return [product.id, product.slug, product.sku ?? ''].filter(Boolean);
}

function findProduct(
  item: CreateStripeCheckoutSessionInput['items'][number],
  products: CheckoutProduct[]
): CheckoutProduct | undefined {
  return products.find((product) => {
    const keys = productKey(product);
    return (
      (item.productId && keys.includes(item.productId)) ||
      (item.slug && keys.includes(item.slug)) ||
      (item.sku && keys.includes(item.sku.toUpperCase()))
    );
  });
}

function availableQuantity(product: CheckoutProduct): number {
  return product.inventoryItems.reduce((total, item) => {
    if (item.status === 'DISCONTINUED') return total;
    return total + Math.max(item.quantityOnHand - item.quantityReserved, 0);
  }, 0);
}

function absoluteImageUrl(siteUrl: string, imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return new URL(imageUrl, siteUrl).toString();
}

function statusAllowsCheckout(status: ProductStatus): boolean {
  return status === 'ACTIVE';
}

checkoutRouter.post(
  '/stripe-session',
  asyncHandler(async (req, res) => {
    const input = createStripeCheckoutSessionSchema.parse(req.body);
    const prisma = getPrismaClient();
    const products = await prisma.product.findMany({
      where: buildProductWhere(input.items),
      include: productInclude,
    });

    const siteUrl = getSiteUrl();
    const lineItems: StripeCheckoutLineItem[] = [];
    const checkoutSkus: string[] = [];
    let subtotalCents = 0;

    for (const item of input.items) {
      const product = findProduct(item, products);

      if (!product) {
        throw notFound('Checkout product not found.', item);
      }

      if (!statusAllowsCheckout(product.status)) {
        throw badRequest('This product is not available for checkout.', {
          sku: product.sku,
          slug: product.slug,
        });
      }

      if (!product.priceCents || product.priceCents <= 0) {
        throw badRequest('This product requires quote confirmation before checkout.', {
          sku: product.sku,
          slug: product.slug,
        });
      }

      const available = availableQuantity(product);
      if (available < item.quantity) {
        throw badRequest('Requested quantity is not currently available.', {
          sku: product.sku,
          slug: product.slug,
          available,
          requested: item.quantity,
        });
      }

      subtotalCents += product.priceCents * item.quantity;
      if (product.sku) checkoutSkus.push(product.sku);

      const image = absoluteImageUrl(siteUrl, product.images[0]?.url);
      lineItems.push({
        quantity: item.quantity,
        price_data: {
          currency: product.currency.toLowerCase(),
          unit_amount: product.priceCents,
          product_data: {
            name: product.name,
            description: product.shortDescription ?? product.description ?? undefined,
            images: image ? [image] : undefined,
            metadata: {
              productId: product.id,
              sku: product.sku ?? '',
              slug: product.slug,
            },
          },
        },
      });
    }

    const stripe = getStripeClient();
    const shippingRate: StripeShippingOption =
      subtotalCents >= 50_000
        ? {
            shipping_rate_data: {
              type: 'fixed_amount' as const,
              fixed_amount: { amount: 0, currency: 'aed' },
              display_name: 'Free UAE shipping',
              delivery_estimate: {
                minimum: { unit: 'business_day' as const, value: 1 },
                maximum: { unit: 'business_day' as const, value: 2 },
              },
            },
          }
        : {
            shipping_rate_data: {
              type: 'fixed_amount' as const,
              fixed_amount: { amount: 2500, currency: 'aed' },
              display_name: 'UAE courier shipping',
              delivery_estimate: {
                minimum: { unit: 'business_day' as const, value: 1 },
                maximum: { unit: 'business_day' as const, value: 2 },
              },
            },
          };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      customer_email: input.customerEmail,
      success_url: input.successUrl ?? `${siteUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: input.cancelUrl ?? `${siteUrl}/shop/cancel`,
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
      shipping_address_collection: {
        allowed_countries: ['AE', 'SA', 'QA', 'KW', 'OM', 'BH'],
      },
      shipping_options: [shippingRate],
      allow_promotion_codes: true,
      metadata: {
        source: 'web_cart',
        item_count: String(input.items.length),
        skus: checkoutSkus.join(',').slice(0, 500),
      },
    });

    if (!session.url) {
      throw new AppError('checkout_session_failed', 'Stripe did not return a checkout URL.', 502);
    }

    await writeAuditLog(req, {
      action: 'checkout.stripe_session.created',
      entityType: 'StripeCheckoutSession',
      entityId: session.id,
      metadata: {
        sessionId: session.id,
        subtotalCents,
        skus: checkoutSkus,
      },
    });

    sendSuccess(res, {
      provider: 'stripe',
      sessionId: session.id,
      url: session.url,
    });
  })
);
