'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useCart } from '@/hooks/use-cart';
import { formatAedFromCents } from '@/lib/cart';

export function CartPageContent() {
  const { items, subtotalCents, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-brand-text">Your cart is empty</h1>
        <p className="mt-3 text-sm text-brand-muted">
          Add tools, software, or workshop equipment from the shop, or request compatibility help
          before buying.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/shop"
            className="rounded-md bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white"
          >
            Browse shop
          </Link>
          <Link
            href="/contact"
            className="rounded-md border border-white/20 px-5 py-2.5 text-sm font-semibold text-brand-text"
          >
            Ask for quote
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
          Shop cart
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-brand-text">Review your order</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.productId}
              className="rounded-lg border border-white/10 bg-white/5 p-4"
            >
              <div className="grid gap-4 sm:grid-cols-[96px_1fr_auto]">
                <div className="relative h-24 w-24 overflow-hidden rounded-lg bg-brand-deep">
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-contain p-2"
                    />
                  )}
                </div>
                <div>
                  <Link
                    href={`/shop/${item.slug}`}
                    className="font-semibold text-brand-text hover:text-brand-orange"
                  >
                    {item.name}
                  </Link>
                  {item.sku && <p className="mt-1 text-xs text-brand-muted">SKU: {item.sku}</p>}
                  <p className="mt-2 text-sm font-semibold text-brand-orange">
                    {item.formattedPrice}
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  <label className="sr-only" htmlFor={`qty-${item.productId}`}>
                    Quantity
                  </label>
                  <input
                    id={`qty-${item.productId}`}
                    type="number"
                    min={1}
                    max={25}
                    value={item.quantity}
                    onChange={(event) => updateQuantity(item.productId, Number(event.target.value))}
                    className="h-10 w-20 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-brand-text"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="text-sm text-brand-muted hover:text-brand-orange"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="h-fit rounded-lg border border-white/10 bg-white/5 p-5">
          <h2 className="font-display text-lg font-bold text-brand-text">Order summary</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between text-brand-muted">
              <span>Subtotal</span>
              <span className="font-semibold text-brand-text">
                {formatAedFromCents(subtotalCents)}
              </span>
            </div>
            <div className="flex justify-between text-brand-muted">
              <span>UAE shipping</span>
              <span>{subtotalCents >= 50_000 ? 'Free' : 'AED 25.00'}</span>
            </div>
          </div>
          <Link
            href="/shop/checkout"
            className="mt-6 block rounded-md bg-brand-orange px-5 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
          >
            Continue to checkout
          </Link>
          <p className="mt-4 text-xs leading-5 text-brand-muted">
            Supplier warranty, compatibility, and final dispatch details are confirmed before
            fulfilment.
          </p>
        </aside>
      </div>
    </div>
  );
}
