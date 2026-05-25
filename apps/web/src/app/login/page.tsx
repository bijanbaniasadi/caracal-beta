import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginForm } from '@/components/account/auth-forms';
import { AuthPageShell } from '@/components/account/auth-page-shell';

export const metadata: Metadata = {
  title: 'Customer Login',
  description: 'Login to your Caracal Tech customer or dealer account.',
  robots: 'noindex, nofollow',
};

export default function LoginPage() {
  return (
    <AuthPageShell
      eyebrow="Dealer and customer access"
      title="Login to your commercial workspace"
      lead="Restore the legacy client workflow with secure account access, saved commercial history, quote references and BIN upload visibility."
    >
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-white/5" />}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
