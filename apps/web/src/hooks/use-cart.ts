'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  addCartItem,
  cartItemCount,
  cartSubtotalCents,
  clearCart,
  productToCartItem,
  readCart,
  removeCartItem,
  subscribeCart,
  updateCartQuantity,
  type CartItem,
} from '@/lib/cart';
import type { Product } from '@/lib/api/catalog-types';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readCart());
    return subscribeCart(() => setItems(readCart()));
  }, []);

  const addProduct = useCallback((product: Product, quantity = 1) => {
    const item = productToCartItem(product, quantity);
    if (!item) return false;
    setItems(addCartItem(item));
    return true;
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems(updateCartQuantity(productId, quantity));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(removeCartItem(productId));
  }, []);

  const clear = useCallback(() => {
    clearCart();
    setItems([]);
  }, []);

  return {
    items,
    count: useMemo(() => cartItemCount(items), [items]),
    subtotalCents: useMemo(() => cartSubtotalCents(items), [items]),
    addProduct,
    updateQuantity,
    removeItem,
    clear,
  };
}
