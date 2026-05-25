import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Checkout Cancelled',
  description:
    'Your Caracal Tech Motors checkout was cancelled. You can return to your cart or request help.',
};

export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <p className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
        Checkout cancelled
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold text-brand-text">No payment was taken</h1>
      <p className="mt-3 text-sm leading-6 text-brand-muted">
        Your cart is still available in this browser. You can return to checkout or ask for invoice
        and bank-transfer options.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/shop/cart"
          className="rounded-md bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white"
        >
          Return to cart
        </Link>
        <a
          href="https://wa.me/971585796760?text=Hi%2C%20I%20need%20help%20with%20checkout"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-white/20 px-5 py-2.5 text-sm font-semibold text-brand-text"
        >
          Ask on WhatsApp
        </a>
      </div>
    </div>
  );
}
