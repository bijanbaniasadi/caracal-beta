import Stripe from 'stripe';

import { AppError } from '../errors.js';
import { logger } from '../logger.js';

export const paymentLogger = logger.child({ component: 'payments' });

export type StripeCheckoutSessionCreateParams = NonNullable<
  Parameters<Stripe['checkout']['sessions']['create']>[0]
>;
export type StripeCheckoutLineItem = NonNullable<StripeCheckoutSessionCreateParams['line_items']>[number];
export type StripeShippingOption = NonNullable<
  StripeCheckoutSessionCreateParams['shipping_options']
>[number];

export function getStripeClient(): Stripe {
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

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new AppError('payment_webhook_unconfigured', 'Stripe webhook is not configured.', 503);
  }

  return secret;
}

export function stripeId(value: string | Stripe.DeletedCustomer | Stripe.Customer | null): string | undefined {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.id;
}
