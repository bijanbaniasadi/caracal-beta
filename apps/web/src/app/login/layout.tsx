import type { ReactNode } from 'react';
import { CustomerAuthProvider } from '@/contexts/customer-auth';

export const metadata = {
  title: 'Sign In | Caracal Tech Motors',
  description: 'Sign in to your Caracal Tech dealer account to track orders, ECU uploads, and workshop inquiries.',
  robots: 'noindex',
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <CustomerAuthProvider>
      <div className="min-h-screen bg-[#071015] text-brand-text">
        {children}
      </div>
    </CustomerAuthProvider>
  );
}
