import type { ReactNode } from 'react';
import { AccountShell } from '@/components/account/account-shell';

export const metadata = {
  title: { default: 'My Account | Caracal Tech', template: '%s | Caracal Tech' },
  robots: 'noindex, nofollow',
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
