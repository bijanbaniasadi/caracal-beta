import { getPrismaClient } from '@caracal/db';
import { readBearerToken } from '@caracal/auth';
import type { Prisma, ProductStatus } from '@prisma/client';
import { Router, type Request, type Router as ExpressRouter } from 'express';
import Stripe from 'stripe';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { verifyAccessToken } from '../lib/auth.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import {
  generateOrderNumber,
  orderInclude,
  releaseOrderReservations,
  serializeOrder,
  shippingCentsForSubtotal,
} from '../lib/payments/orders.js';
import {
  getStripeClient,
  getStripeWebhookSecret,
  paymentLogger,
  stripeId,
  type StripeCheckoutLineItem,
  type StripeShippingOption,
} from '../lib/payments/stripe.js';
import { toPrismaJson } from '../lib/prisma-json.js';
import {
  createStripeCheckoutSessionSchema,
  type CreateStripeCheckoutSessionInput,
} from '../schemas/checkout.js';

export const checkoutRouter: ExpressRouter = Router();
export const checkoutWebhookRouter: ExpressRouter = Router();

const productInclude = {
  images: {
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    select: {
      url: true,
      isPrimary: true,
    },
  },
  inventoryItems: {
    orderBy: [{ locationKey: 'asc' }],
    select: {
      id: true,
      locationKey: true,
      quantityOnHand: true,
      quantityReserved: true,
      status: true,
    },
  },
} satisfies Prisma.ProductInclude;

type CheckoutProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

interface PendingOrderItem {
  product: CheckoutProduct;
  quantity: number;
  reservedInventoryItemId: string;
}

async function getCheckoutUser(req: Request) {
  const token = readBearerToken(req.get('authorization'));

  if (!token) {
    return null;
  }

  try {
    const payload = verifyAccessToken(token);
    const prisma = getPrismaClient();
    return prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
      },
    });
  } catch {
    return null;
  }
}

function getSiteUrl(): string {
  return (
    process.env.PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.WEB_URL ??
    process.env.APP_BASE_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '');
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

function statusAllowsCheckout(status: ProductStatus): boolean {
  return status === 'ACTIVE';
}

function availableQuantity(product: CheckoutProduct): number {
  return product.inventoryItems.reduce((total, item) => {
    if (item.status === 'DISCONTINUED') return total;
    return total + Math.max(item.quantityOnHand - item.quantityReserved, 0);
  }, 0);
}

function reserveFromInventory(product: CheckoutProduct, quantity: number): string {
  const reservable = product.inventoryItems.find((item) => {
    if (item.status === 'DISCONTINUED') return false;
    return item.quantityOnHand - item.quantityReserved >= quantity;
  });

  if (!reservable) {
    throw badRequest('Requested quantity is not available from a single fulfilment location.', {
      sku: product.sku,
      slug: product.slug,
      available: availableQuantity(product),
      requested: quantity,
    });
  }

  return reservable.id;
}

function absoluteImageUrl(siteUrl: string, imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return new URL(imageUrl, siteUrl).toString();
}

function safeReturnUrl(inputUrl: string | undefined, fallbackUrl: string, siteUrl: string): string {
  if (!inputUrl) return fallbackUrl;

  const expectedOrigin = new URL(siteUrl).origin;
  const parsed = new URL(inputUrl);
  if (parsed.origin !== expectedOrigin) {
    throw badRequest('Checkout return URL must use the configured storefront origin.', {
      origin: parsed.origin,
      expectedOrigin,
    });
  }

  return parsed.toString();
}

function stripeObjectId(
  value: string | Stripe.PaymentIntent | Stripe.Charge | null
): string | undefined {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.id;
}

function sessionOrderId(session: Stripe.Checkout.Session): string | undefined {
  return session.metadata?.orderId ?? session.client_reference_id ?? undefined;
}

function eventObjectId(event: Stripe.Event): string | undefined {
  const object = event.data.object as { id?: string };
  return object.id;
}

function validateSessionAgainstOrder(
  session: Stripe.Checkout.Session,
  order: { id: string; totalCents: number; currency: string }
) {
  const orderId = sessionOrderId(session);
  if (orderId && orderId !== order.id) {
    throw new AppError(
      'checkout_session_mismatch',
      'Stripe session does not match this order.',
      409,
      {
        orderId: order.id,
        sessionOrderId: orderId,
      }
    );
  }

  if (session.amount_total !== null && session.amount_total !== order.totalCents) {
    throw new AppError(
      'checkout_amount_mismatch',
      'Stripe session amount does not match this order.',
      409,
      {
        orderTotalCents: order.totalCents,
        sessionAmountTotal: session.amount_total,
      }
    );
  }

  if (session.currency && session.currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw new AppError(
      'checkout_currency_mismatch',
      'Stripe session currency does not match this order.',
      409,
      {
        orderCurrency: order.currency,
        sessionCurrency: session.currency,
      }
    );
  }
}

async function markOrderPaidFromSession(session: Stripe.Checkout.Session): Promise<void> {
  const prisma = getPrismaClient();
  const orderId = sessionOrderId(session);
  const paymentIntentId = stripeObjectId(
    session.payment_intent as string | Stripe.PaymentIntent | null
  );
  const customerId = stripeId(
    session.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null
  );

  const order = orderId
    ? await prisma.order.findUnique({ where: { id: orderId } })
    : await prisma.order.findUnique({ where: { stripeCheckoutSessionId: session.id } });

  if (!order) {
    throw notFound('Order for Stripe checkout session was not found.', {
      orderId,
      sessionId: session.id,
    });
  }

  validateSessionAgainstOrder(session, order);

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paymentStatus: 'PAID',
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: customerId,
        stripePaymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email ?? order.customerEmail,
        customerName: session.customer_details?.name ?? order.customerName,
        customerPhone: session.customer_details?.phone ?? order.customerPhone,
        paidAt: order.paidAt ?? new Date(),
      },
    }),
    prisma.orderPayment.upsert({
      where: { stripeCheckoutSessionId: session.id },
      create: {
        orderId: order.id,
        provider: 'STRIPE',
        status: 'PAID',
        amountCents: order.totalCents,
        currency: order.currency,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
        metadata: toPrismaJson({
          paymentStatus: session.payment_status,
          mode: session.mode,
        }),
      },
      update: {
        status: 'PAID',
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
        metadata: toPrismaJson({
          paymentStatus: session.payment_status,
          mode: session.mode,
        }),
      },
    }),
  ]);
}

async function markOrderFailedOrCancelled(params: {
  orderId?: string;
  sessionId?: string;
  paymentIntentId?: string;
  status: 'FAILED' | 'CANCELLED';
  reason?: string;
}): Promise<void> {
  const prisma = getPrismaClient();
  const order = params.orderId
    ? await prisma.order.findUnique({ where: { id: params.orderId } })
    : params.sessionId
      ? await prisma.order.findUnique({ where: { stripeCheckoutSessionId: params.sessionId } })
      : params.paymentIntentId
        ? await prisma.order.findUnique({
            where: { stripePaymentIntentId: params.paymentIntentId },
          })
        : null;

  if (!order || order.paymentStatus === 'PAID') return;

  await prisma.$transaction(async (tx) => {
    await releaseOrderReservations(tx, order.id);
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        paymentStatus: params.status,
        fulfillmentStatus: 'CANCELLED',
        cancelledAt: order.cancelledAt ?? new Date(),
        stripePaymentStatus: params.reason,
      },
    });
    await tx.orderPayment.updateMany({
      where: { orderId: order.id, provider: 'STRIPE' },
      data: {
        status: params.status,
        failedAt: params.status === 'FAILED' ? new Date() : undefined,
        failureMessage: params.reason,
      },
    });
  });
}

async function markOrderRefunded(params: {
  paymentIntentId?: string;
  chargeId?: string;
  refundId?: string;
  refundedCents: number;
  amountCents?: number;
  failed?: boolean;
}): Promise<void> {
  const prisma = getPrismaClient();
  const payment = params.paymentIntentId
    ? await prisma.orderPayment.findFirst({
        where: { stripePaymentIntentId: params.paymentIntentId },
        include: { order: true },
      })
    : params.chargeId
      ? await prisma.orderPayment.findFirst({
          where: { stripeChargeId: params.chargeId },
          include: { order: true },
        })
      : null;

  if (!payment) return;

  const totalCents = params.amountCents ?? payment.amountCents;
  const fullyRefunded = params.refundedCents >= totalCents;
  const paymentStatus = params.failed ? 'PAID' : fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  const refundStatus = params.failed ? 'FAILED' : fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  const orderStatus = params.failed
    ? payment.order.status
    : fullyRefunded
      ? 'REFUNDED'
      : 'PARTIALLY_REFUNDED';

  await prisma.$transaction(async (tx) => {
    if (!params.failed && fullyRefunded) {
      await releaseOrderReservations(tx, payment.orderId);
    }

    await tx.order.update({
      where: { id: payment.orderId },
      data: {
        status: orderStatus,
        paymentStatus,
        refundStatus,
        refundedAt: params.failed ? payment.order.refundedAt : new Date(),
      },
    });
    await tx.orderPayment.update({
      where: { id: payment.id },
      data: {
        status: paymentStatus,
        refundedCents: params.refundedCents,
        stripeRefundId: params.refundId,
        refundedAt: params.failed ? payment.refundedAt : new Date(),
      },
    });
  });
}

checkoutRouter.post(
  '/stripe-session',
  asyncHandler(async (req, res) => {
    const input = createStripeCheckoutSessionSchema.parse(req.body);
    const prisma = getPrismaClient();
    const checkoutUser = await getCheckoutUser(req);
    const customerEmail =
      input.customerEmail ?? (checkoutUser?.isActive ? checkoutUser.email : undefined);

    if (!customerEmail) {
      throw badRequest('Customer email is required for checkout.');
    }

    const products = await prisma.product.findMany({
      where: buildProductWhere(input.items),
      include: productInclude,
    });

    const siteUrl = getSiteUrl();
    const lineItems: StripeCheckoutLineItem[] = [];
    const pendingItems: PendingOrderItem[] = [];
    const checkoutSkus: string[] = [];
    let subtotalCents = 0;
    let currency: string | undefined;

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

      const reservedInventoryItemId = reserveFromInventory(product, item.quantity);
      if (currency && product.currency !== currency) {
        throw badRequest('Checkout currently requires all items to use the same currency.', {
          expectedCurrency: currency,
          productCurrency: product.currency,
          sku: product.sku,
        });
      }

      subtotalCents += product.priceCents * item.quantity;
      currency = product.currency;
      if (product.sku) checkoutSkus.push(product.sku);
      pendingItems.push({ product, quantity: item.quantity, reservedInventoryItemId });

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

    const checkoutCurrency = currency ?? 'AED';
    const shippingCents = shippingCentsForSubtotal(subtotalCents);
    const totalCents = subtotalCents + shippingCents;
    const stripe = getStripeClient();

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: checkoutUser?.isActive ? checkoutUser.id : undefined,
          customerEmail,
          customerName: checkoutUser?.isActive ? checkoutUser.name : undefined,
          customerPhone: checkoutUser?.isActive ? checkoutUser.phone : undefined,
          currency: checkoutCurrency,
          subtotalCents,
          shippingCents,
          totalCents,
          metadata: toPrismaJson({
            source: 'web_cart',
            requestId: res.locals.requestId,
          }),
          items: {
            create: pendingItems.map(({ product, quantity, reservedInventoryItemId }) => ({
              productId: product.id,
              sku: product.sku,
              slug: product.slug,
              name: product.name,
              quantity,
              unitPriceCents: product.priceCents ?? 0,
              lineTotalCents: (product.priceCents ?? 0) * quantity,
              currency: product.currency,
              reservedInventoryItemId,
              reservedQuantity: quantity,
              metadata: toPrismaJson({ categoryId: product.categoryId }),
            })),
          },
          payments: {
            create: {
              provider: 'STRIPE',
              status: 'PENDING',
              amountCents: totalCents,
              currency: checkoutCurrency,
            },
          },
        },
        include: orderInclude,
      });

      for (const item of pendingItems) {
        await tx.inventoryItem.update({
          where: { id: item.reservedInventoryItemId },
          data: { quantityReserved: { increment: item.quantity } },
        });
      }

      return created;
    });

    const shippingRate: StripeShippingOption =
      shippingCents === 0
        ? {
            shipping_rate_data: {
              type: 'fixed_amount' as const,
              fixed_amount: { amount: 0, currency: checkoutCurrency.toLowerCase() },
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
              fixed_amount: { amount: shippingCents, currency: checkoutCurrency.toLowerCase() },
              display_name: 'UAE courier shipping',
              delivery_estimate: {
                minimum: { unit: 'business_day' as const, value: 1 },
                maximum: { unit: 'business_day' as const, value: 2 },
              },
            },
          };

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        customer_email: customerEmail,
        success_url: safeReturnUrl(
          input.successUrl,
          `${siteUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
          siteUrl
        ),
        cancel_url: safeReturnUrl(input.cancelUrl, `${siteUrl}/shop/cancel`, siteUrl),
        billing_address_collection: 'auto',
        phone_number_collection: { enabled: true },
        shipping_address_collection: {
          allowed_countries: ['AE', 'SA', 'QA', 'KW', 'OM', 'BH'],
        },
        shipping_options: [shippingRate],
        allow_promotion_codes: true,
        client_reference_id: order.id,
        payment_intent_data: {
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
          },
        },
        metadata: {
          source: 'web_cart',
          orderId: order.id,
          orderNumber: order.orderNumber,
          item_count: String(input.items.length),
          skus: checkoutSkus.join(',').slice(0, 500),
        },
      });

      if (!session.url) {
        throw new AppError('checkout_session_failed', 'Stripe did not return a checkout URL.', 502);
      }

      const checkoutExpiresAt = session.expires_at
        ? new Date(session.expires_at * 1000)
        : undefined;
      const updatedOrder = await prisma.$transaction(async (tx) => {
        await tx.orderPayment.updateMany({
          where: { orderId: order.id, provider: 'STRIPE' },
          data: {
            stripeCheckoutSessionId: session.id,
            metadata: toPrismaJson({ mode: session.mode, paymentStatus: session.payment_status }),
          },
        });

        return tx.order.update({
          where: { id: order.id },
          data: {
            stripeCheckoutSessionId: session.id,
            stripePaymentStatus: session.payment_status,
            checkoutExpiresAt,
          },
          include: orderInclude,
        });
      });

      paymentLogger.info(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          sessionId: session.id,
          totalCents,
          currency: checkoutCurrency,
        },
        'stripe checkout session created'
      );

      await writeAuditLog(req, {
        action: 'checkout.stripe_session.created',
        entityType: 'Order',
        entityId: order.id,
        metadata: {
          sessionId: session.id,
          orderNumber: order.orderNumber,
          subtotalCents,
          shippingCents,
          totalCents,
          skus: checkoutSkus,
        },
      });

      sendSuccess(res, {
        provider: 'stripe',
        sessionId: session.id,
        order: serializeOrder(updatedOrder),
        url: session.url,
      });
    } catch (error) {
      paymentLogger.error(
        { err: error, orderId: order.id, orderNumber: order.orderNumber },
        'stripe checkout session creation failed'
      );

      await prisma.$transaction(async (tx) => {
        await releaseOrderReservations(tx, order.id);
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            paymentStatus: 'FAILED',
            fulfillmentStatus: 'CANCELLED',
            cancelledAt: new Date(),
          },
        });
        await tx.orderPayment.updateMany({
          where: { orderId: order.id, provider: 'STRIPE' },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureMessage: error instanceof Error ? error.message : 'Stripe checkout failed',
          },
        });
      });

      throw error;
    }
  })
);

checkoutRouter.get(
  '/stripe-session/:sessionId',
  asyncHandler(async (req, res) => {
    const sessionId = req.params.sessionId;
    if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId)) {
      throw badRequest('Invalid Stripe checkout session id.', { sessionId });
    }

    const prisma = getPrismaClient();
    const order = await prisma.order.findUnique({
      where: { stripeCheckoutSessionId: sessionId },
      include: orderInclude,
    });

    if (!order) {
      throw notFound('Checkout session order was not found.', { sessionId });
    }

    let stripeSession: Stripe.Checkout.Session | null = null;
    if (process.env.STRIPE_SECRET_KEY) {
      stripeSession = await getStripeClient().checkout.sessions.retrieve(sessionId);
      validateSessionAgainstOrder(stripeSession, order);
    }

    sendSuccess(res, {
      order: serializeOrder(order),
      stripe: stripeSession
        ? {
            id: stripeSession.id,
            status: stripeSession.status,
            paymentStatus: stripeSession.payment_status,
            amountTotal: stripeSession.amount_total,
            currency: stripeSession.currency,
          }
        : null,
    });
  })
);

checkoutWebhookRouter.post(
  '/stripe',
  asyncHandler(async (req: Request, res) => {
    const signature = req.header('stripe-signature');
    if (!signature) {
      throw badRequest('Missing Stripe signature header.');
    }

    const stripe = getStripeClient();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, signature, getStripeWebhookSecret());
    } catch (error) {
      paymentLogger.error({ err: error }, 'stripe webhook signature verification failed');
      throw badRequest('Invalid Stripe webhook signature.');
    }

    const prisma = getPrismaClient();
    const objectId = eventObjectId(event);

    const existing = await prisma.paymentWebhookEvent.findUnique({
      where: { providerEventId: event.id },
      select: { id: true, processedAt: true },
    });

    if (existing?.processedAt) {
      sendSuccess(res, { received: true, duplicate: true });
      return;
    }

    const webhookEvent =
      existing ??
      (await prisma.paymentWebhookEvent.create({
        data: {
          provider: 'STRIPE',
          providerEventId: event.id,
          type: event.type,
          objectId,
          livemode: event.livemode,
          payload: toPrismaJson(event),
        },
        select: { id: true, processedAt: true },
      }));

    try {
      paymentLogger.info(
        { eventId: event.id, eventType: event.type, objectId, livemode: event.livemode },
        'stripe webhook received'
      );

      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          await markOrderPaidFromSession(event.data.object as Stripe.Checkout.Session);
          break;

        case 'checkout.session.expired': {
          const session = event.data.object as Stripe.Checkout.Session;
          await markOrderFailedOrCancelled({
            orderId: sessionOrderId(session),
            sessionId: session.id,
            status: 'CANCELLED',
            reason: session.status ?? 'expired',
          });
          break;
        }

        case 'checkout.session.async_payment_failed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await markOrderFailedOrCancelled({
            orderId: sessionOrderId(session),
            sessionId: session.id,
            status: 'FAILED',
            reason: session.payment_status,
          });
          break;
        }

        case 'payment_intent.succeeded': {
          const intent = event.data.object as Stripe.PaymentIntent;
          await prisma.order.updateMany({
            where: { OR: [{ id: intent.metadata.orderId }, { stripePaymentIntentId: intent.id }] },
            data: {
              status: 'PAID',
              paymentStatus: 'PAID',
              stripePaymentIntentId: intent.id,
              paidAt: new Date(),
            },
          });
          await prisma.orderPayment.updateMany({
            where: {
              OR: [
                { stripePaymentIntentId: intent.id },
                { orderId: intent.metadata.orderId, provider: 'STRIPE' },
              ],
            },
            data: {
              status: 'PAID',
              stripePaymentIntentId: intent.id,
              paidAt: new Date(),
            },
          });
          break;
        }

        case 'payment_intent.payment_failed': {
          const intent = event.data.object as Stripe.PaymentIntent;
          await markOrderFailedOrCancelled({
            orderId: intent.metadata.orderId,
            paymentIntentId: intent.id,
            status: 'FAILED',
            reason: intent.last_payment_error?.message ?? intent.status,
          });
          break;
        }

        case 'payment_intent.canceled': {
          const intent = event.data.object as Stripe.PaymentIntent;
          await markOrderFailedOrCancelled({
            orderId: intent.metadata.orderId,
            paymentIntentId: intent.id,
            status: 'CANCELLED',
            reason: intent.cancellation_reason ?? intent.status,
          });
          break;
        }

        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          await markOrderRefunded({
            paymentIntentId: stripeObjectId(
              charge.payment_intent as string | Stripe.PaymentIntent | null
            ),
            chargeId: charge.id,
            refundedCents: charge.amount_refunded,
            amountCents: charge.amount,
          });
          break;
        }

        case 'refund.created':
        case 'refund.updated':
        case 'refund.failed': {
          const refund = event.data.object as Stripe.Refund;
          await markOrderRefunded({
            paymentIntentId: stripeObjectId(
              refund.payment_intent as string | Stripe.PaymentIntent | null
            ),
            chargeId: stripeObjectId(refund.charge as string | Stripe.Charge | null),
            refundId: refund.id,
            refundedCents: refund.amount,
            failed: event.type === 'refund.failed',
          });
          break;
        }

        default:
          paymentLogger.info(
            { eventId: event.id, eventType: event.type },
            'stripe webhook ignored'
          );
      }

      await prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processedAt: new Date(),
          processingError: null,
        },
      });

      sendSuccess(res, { received: true });
    } catch (error) {
      paymentLogger.error(
        { err: error, eventId: event.id, eventType: event.type, objectId },
        'stripe webhook processing failed'
      );

      await prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processingError: error instanceof Error ? error.message : 'Webhook processing failed',
        },
      });

      throw error;
    }
  })
);
