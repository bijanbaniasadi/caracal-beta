import { randomBytes } from 'node:crypto';

import type { Prisma } from '@prisma/client';

export const orderInclude = {
  items: {
    orderBy: [{ createdAt: 'asc' }],
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          slug: true,
          name: true,
          status: true,
        },
      },
    },
  },
  payments: {
    orderBy: [{ createdAt: 'desc' }],
  },
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function generateOrderNumber(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `CTM-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export function shippingCentsForSubtotal(subtotalCents: number): number {
  return subtotalCents >= 50_000 ? 0 : 2_500;
}

export function serializeOrder(order: OrderWithDetails) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    user: order.user,
    customer: {
      email: order.customerEmail,
      name: order.customerName,
      phone: order.customerPhone,
    },
    amounts: {
      currency: order.currency,
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
    },
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    refundStatus: order.refundStatus,
    stripe: {
      checkoutSessionId: order.stripeCheckoutSessionId,
      paymentIntentId: order.stripePaymentIntentId,
      customerId: order.stripeCustomerId,
      paymentStatus: order.stripePaymentStatus,
    },
    checkoutExpiresAt: order.checkoutExpiresAt,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
    refundedAt: order.refundedAt,
    shippingTracking: order.shippingTracking,
    adminNotes: order.adminNotes,
    metadata: order.metadata,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      sku: item.sku,
      slug: item.slug,
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
      currency: item.currency,
      product: item.product,
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      status: payment.status,
      amountCents: payment.amountCents,
      refundedCents: payment.refundedCents,
      currency: payment.currency,
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      stripeChargeId: payment.stripeChargeId,
      stripeRefundId: payment.stripeRefundId,
      failureCode: payment.failureCode,
      failureMessage: payment.failureMessage,
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
      refundedAt: payment.refundedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function releaseOrderReservations(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      reservationsReleased: true,
      items: {
        select: {
          reservedInventoryItemId: true,
          reservedQuantity: true,
        },
      },
    },
  });

  if (!order || order.reservationsReleased) {
    return;
  }

  for (const item of order.items) {
    if (!item.reservedInventoryItemId || item.reservedQuantity <= 0) continue;
    await tx.$executeRaw`
      UPDATE "InventoryItem"
      SET "quantityReserved" = GREATEST("quantityReserved" - ${item.reservedQuantity}, 0),
          "updatedAt" = NOW()
      WHERE "id" = ${item.reservedInventoryItemId}
    `;
  }

  await tx.order.update({
    where: { id: order.id },
    data: { reservationsReleased: true },
  });
}
