'use client';

import { useState } from 'react';
import Link from 'next/link';

import { useCart } from '@/hooks/use-cart';
import type { Product } from '@/lib/api/catalog-types';

export function AddToCartButton({ product }: { product: Product }) {
  const { addProduct } = useCart();
  const [added, setAdded] = useState(false);

  const canCheckout =
    Boolean(product.price.amountCents) &&
    product.inventory.status !== 'OUT_OF_STOCK' &&
    product.inventory.status !== 'DISCONTINUED';

  if (!canCheckout) {
    return null;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <button
        type="button"
        onClick={() => {
          const ok = addProduct(product, 1);
          setAdded(ok);
        }}
        className="rounded-md bg-brand-orange px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        {added ? 'Added to cart' : 'Add to cart'}
      </button>
      <Link
        href="/shop/cart"
        className="rounded-md border border-white/20 px-5 py-3 text-center text-sm font-semibold text-brand-text transition-colors hover:bg-white/5"
      >
        View cart
      </Link>
    </div>
  );
}
