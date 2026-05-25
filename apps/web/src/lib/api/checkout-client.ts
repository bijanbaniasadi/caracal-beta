import { CaracalApiError } from './client';

export interface CheckoutLineItemInput {
  productId: string;
  sku?: string | null;
  slug: string;
  quantity: number;
}

export interface StripeCheckoutSessionInput {
  items: CheckoutLineItemInput[];
  customerEmail?: string;
}

export interface StripeCheckoutSessionResponse {
  provider: 'stripe';
  sessionId: string;
  url: string;
}

interface CheckoutEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
  };
}

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export async function createStripeCheckoutSession(
  input: StripeCheckoutSessionInput
): Promise<StripeCheckoutSessionResponse> {
  const response = await fetch(`${getApiBase()}/api/checkout/stripe-session`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const body = (await response.json()) as CheckoutEnvelope<StripeCheckoutSessionResponse>;

  if (body.success && body.data) {
    return body.data;
  }

  throw new CaracalApiError({
    code: body.error?.code ?? 'internal_server_error',
    message: body.error?.message ?? 'Checkout failed.',
    status: response.status,
    details: body.error?.details,
    requestId: body.meta?.requestId,
  });
}
