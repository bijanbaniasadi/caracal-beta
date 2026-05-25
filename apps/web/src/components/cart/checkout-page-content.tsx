'use client';

import { useState } from 'react';
import Link from 'next/link';

import { createStripeCheckoutSession } from '@/lib/api/checkout-client';
import { formatAedFromCents } from '@/lib/cart';
import { useCart } from '@/hooks/use-cart';

export function CheckoutPageContent() {
  const { items, subtotalCents } = useCart();
  const [customerEmail, setCustomerEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitCheckout() {
    setError(null);
    setLoading(true);

    try {
      const session = await createStripeCheckoutSession({
        customerEmail: customerEmail.trim() || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          sku: item.sku,
          slug: item.slug,
          quantity: item.quantity,
        })),
      });
      window.location.href = session.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Checkout failed.');
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-brand-text">Checkout</h1>
        <p className="mt-3 text-sm text-brand-muted">Your cart is empty.</p>
        <Link
          href="/shop"
          className="mt-6 inline-flex rounded-md bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white"
        >
          Browse shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
          Secure checkout
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-brand-text">
          Checkout with Stripe
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">
          You will be redirected to Stripe-hosted Checkout for card payment. For bank transfer or
          invoice, use WhatsApp or the quote form.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-white/10 bg-white/5 p-5">
          <label className="text-sm font-semibold text-brand-text" htmlFor="checkout-email">
            Email for receipt
          </label>
          <input
            id="checkout-email"
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-2 h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-brand-text placeholder:text-brand-muted"
          />

          {error && (
            <div className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submitCheckout}
            disabled={loading}
            className="mt-6 w-full rounded-md bg-brand-orange px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating checkout...' : 'Pay securely with Stripe'}
          </button>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://wa.me/971585796760?text=Hi%2C%20I%20want%20to%20confirm%20a%20shop%20order"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-orange hover:underline"
            >
              Request invoice or bank transfer
            </a>
            <Link href="/shop/cart" className="text-sm text-brand-muted hover:text-brand-text">
              Back to cart
            </Link>
          </div>
        </section>

        <aside className="h-fit rounded-lg border border-white/10 bg-white/5 p-5">
          <h2 className="font-display text-lg font-bold text-brand-text">Order summary</h2>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between gap-4 text-sm">
                <span className="text-brand-muted">
                  {item.quantity} x {item.name}
                </span>
                <span className="font-semibold text-brand-text">
                  {formatAedFromCents(item.priceCents * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between text-brand-muted">
              <span>Subtotal</span>
              <span className="font-semibold text-brand-text">
                {formatAedFromCents(subtotalCents)}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-brand-muted">
              <span>UAE shipping</span>
              <span>{subtotalCents >= 50_000 ? 'Free' : 'AED 25.00'}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
