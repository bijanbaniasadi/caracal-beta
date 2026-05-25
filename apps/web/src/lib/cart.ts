import type { Product } from '@/lib/api/catalog-types';

export interface CartItem {
  productId: string;
  slug: string;
  sku: string | null;
  name: string;
  priceCents: number;
  currency: string;
  formattedPrice: string;
  imageUrl: string | null;
  quantity: number;
}

const CART_STORAGE_KEY = 'caracal.shop.cart.v1';
const CART_EVENT = 'caracal:cart-updated';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function readCart(): CartItem[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item.quantity > 0) : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function clearCart(): void {
  writeCart([]);
}

export function subscribeCart(listener: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  window.addEventListener(CART_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CART_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

export function productToCartItem(product: Product, quantity = 1): CartItem | null {
  if (!product.price.amountCents || product.price.amountCents <= 0) return null;

  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];

  return {
    productId: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    priceCents: product.price.amountCents,
    currency: product.price.currency,
    formattedPrice:
      product.price.formatted ?? `AED ${(product.price.amountCents / 100).toFixed(2)}`,
    imageUrl: primaryImage?.url ?? null,
    quantity,
  };
}

export function addCartItem(item: CartItem): CartItem[] {
  const current = readCart();
  const existing = current.find((cartItem) => cartItem.productId === item.productId);

  const next = existing
    ? current.map((cartItem) =>
        cartItem.productId === item.productId
          ? { ...cartItem, quantity: Math.min(cartItem.quantity + item.quantity, 25) }
          : cartItem
      )
    : [...current, item];

  writeCart(next);
  return next;
}

export function updateCartQuantity(productId: string, quantity: number): CartItem[] {
  const next = readCart()
    .map((item) =>
      item.productId === productId
        ? { ...item, quantity: Math.max(0, Math.min(quantity, 25)) }
        : item
    )
    .filter((item) => item.quantity > 0);

  writeCart(next);
  return next;
}

export function removeCartItem(productId: string): CartItem[] {
  const next = readCart().filter((item) => item.productId !== productId);
  writeCart(next);
  return next;
}

export function cartSubtotalCents(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.priceCents * item.quantity, 0);
}

export function formatAedFromCents(amountCents: number): string {
  return `AED ${(amountCents / 100).toFixed(2)}`;
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}
