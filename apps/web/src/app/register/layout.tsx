import type { ReactNode } from 'react';

export const metadata = {
  title: 'Create Account | Caracal Tech Motors',
  description:
    'Register for a Caracal Tech dealer account to access workshop pricing, ECU file uploads, and order tracking.',
  robots: 'noindex',
};

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#071015] text-brand-text">{children}</div>;
}
