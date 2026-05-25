import type { Metadata } from 'next';

import { RegisterForm } from '@/components/account/auth-forms';
import { AuthPageShell } from '@/components/account/auth-page-shell';

export const metadata: Metadata = {
  title: 'Create Customer Account',
  description: 'Create a Caracal Tech commercial account for workshop support and order history.',
  robots: 'noindex, nofollow',
};

export default function RegisterPage() {
  return (
    <AuthPageShell
      eyebrow="Workshop registration"
      title="Create a customer account"
      lead="Use one commercial login for product orders, support inquiries, quote requests and uploaded file history."
    >
      <RegisterForm />
    </AuthPageShell>
  );
}
