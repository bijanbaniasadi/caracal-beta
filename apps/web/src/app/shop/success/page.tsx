import type { Metadata } from 'next';
import Link from 'next/link';
import { ClearCartOnMount } from '@/components/cart/clear-cart-on-mount';

export const metadata: Metadata = {
  title: 'Order Received',
  description: 'Your Caracal Tech Motors checkout was completed successfully.',
};

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <ClearCartOnMount />
      <p className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
        Payment received
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold text-brand-text">Order received</h1>
      <p className="mt-3 text-sm leading-6 text-brand-muted">
        Thank you. We will confirm stock, shipping, supplier warranty, and any compatibility details
        before fulfilment.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/shop"
          className="rounded-md bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white"
        >
          Continue shopping
        </Link>
        <Link
          href="/contact"
          className="rounded-md border border-white/20 px-5 py-2.5 text-sm font-semibold text-brand-text"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}
