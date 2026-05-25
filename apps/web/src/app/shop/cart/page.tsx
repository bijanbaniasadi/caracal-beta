import type { Metadata } from 'next';
import { CartPageContent } from '@/components/cart/cart-page-content';

export const metadata: Metadata = {
  title: 'Cart',
  description: 'Review your Caracal Tech Motors shop cart before secure checkout.',
};

export default function CartPage() {
  return <CartPageContent />;
}
