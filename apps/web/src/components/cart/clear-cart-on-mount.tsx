'use client';

import { useEffect } from 'react';
import { clearCart } from '@/lib/cart';

export function ClearCartOnMount() {
  useEffect(() => {
    clearCart();
  }, []);

  return null;
}
