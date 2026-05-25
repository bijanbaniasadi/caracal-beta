import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/components/account/auth-forms';
import { AuthPageShell } from '@/components/account/auth-page-shell';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Request a Caracal Tech customer account password reset.',
  robots: 'noindex, nofollow',
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      eyebrow="Account recovery"
      title="Recover customer access"
      lead="Reset your commercial account without losing restored order, inquiry and upload history tied to your email."
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
