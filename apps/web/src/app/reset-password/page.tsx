import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ResetPasswordForm } from '@/components/account/auth-forms';
import { AuthPageShell } from '@/components/account/auth-page-shell';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Set a new password for your Caracal Tech customer account.',
  robots: 'noindex, nofollow',
};

export default function ResetPasswordPage() {
  return (
    <AuthPageShell
      eyebrow="Account restoration"
      title="Set a new password"
      lead="Complete account restoration and return to your customer workspace."
    >
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-white/5" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthPageShell>
  );
}
