import type { ReactNode } from 'react';

export const metadata = {
  title: 'Reset Password | Caracal Tech Motors',
  robots: 'noindex',
};

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#071015] text-brand-text">{children}</div>;
}
