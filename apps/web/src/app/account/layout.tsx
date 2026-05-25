import type { ReactNode } from 'react';
import { CustomerAuthProvider } from '@/contexts/customer-auth';
import { AccountShell } from '@/components/account/account-shell';

export const metadata = {
  title: { default: 'My Account | Caracal Tech', template: '%s | Caracal Tech' },
  robots: 'noindex, nofollow',
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <CustomerAuthProvider>
      <AccountShell>{children}</AccountShell>
    </CustomerAuthProvider>
  );
}
