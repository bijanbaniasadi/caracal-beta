import type { ReactNode } from 'react';
import { CustomerAuthProvider } from '@/contexts/customer-auth';

export const metadata = {
  title: 'Reset Password | Caracal Tech Motors',
  robots: 'noindex',
};

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return (
    <CustomerAuthProvider>
      <div className="min-h-screen bg-[#071015] text-brand-text">
        {children}
      </div>
    </CustomerAuthProvider>
  );
}
