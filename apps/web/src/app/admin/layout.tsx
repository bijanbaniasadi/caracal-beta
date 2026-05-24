import type { ReactNode } from 'react';
import { AdminAuthProvider } from '@/contexts/admin-auth';
import { AdminLayoutShell } from './admin-layout-shell';

export const metadata = {
  title: { default: 'Admin | Caracal Tech', template: '%s | Admin' },
  robots: 'noindex, nofollow',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </AdminAuthProvider>
  );
}
