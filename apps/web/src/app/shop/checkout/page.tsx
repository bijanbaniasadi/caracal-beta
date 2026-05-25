import type { Metadata } from 'next';
import { CheckoutPageContent } from '@/components/cart/checkout-page-content';

export const metadata: Metadata = {
  title: 'Checkout',
  description:
    'Secure Stripe checkout for Caracal Tech Motors tools, software, and workshop equipment.',
};

export default function CheckoutPage() {
  return <CheckoutPageContent />;
}
