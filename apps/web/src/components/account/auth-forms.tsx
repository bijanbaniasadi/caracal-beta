'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useCustomerAuth } from '@/contexts/customer-auth';
import { requestPasswordReset, resetPassword } from '@/lib/api/customer-client';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-brand-text placeholder-brand-muted/50 outline-none transition-colors focus:border-brand-orange/50 focus:ring-1 focus:ring-brand-orange/30';

function AuthError({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}

function Field({
  id,
  label,
  type = 'text',
  value,
  autoComplete,
  required = false,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-muted"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </div>
  );
}

function SubmitButton({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand-orange px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? busy : idle}
    </button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, session, isLoading } = useCustomerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const returnTo = searchParams.get('returnTo');

  useEffect(() => {
    if (!isLoading && session) {
      router.replace(returnTo?.startsWith('/account') ? returnTo : '/account');
    }
  }, [isLoading, returnTo, router, session]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setPending(true);

    try {
      await login({ email, password });
      router.replace(returnTo?.startsWith('/account') ? returnTo : '/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-5"
    >
      <div>
        <p className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
          Secure sign in
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-brand-text">Open your account</h2>
      </div>
      <AuthError message={error} />
      <Field
        id="email"
        label="Email"
        type="email"
        value={email}
        required
        autoComplete="email"
        placeholder="you@workshop.com"
        onChange={setEmail}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        value={password}
        required
        autoComplete="current-password"
        placeholder="********"
        onChange={setPassword}
      />
      <SubmitButton pending={pending} idle="Login" busy="Signing in..." />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-brand-muted">
        <Link href="/forgot-password" className="hover:text-brand-text">
          Forgot password?
        </Link>
        <Link
          href="/register"
          className="font-semibold text-brand-orange hover:text-brand-orange-soft"
        >
          Create account
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const { register, session, isLoading } = useCustomerAuth();
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [workshopName, setWorkshopName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isLoading && session) {
      router.replace('/account');
    }
  }, [isLoading, router, session]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setPending(true);

    try {
      await register({
        name,
        companyName: companyName || undefined,
        workshopName: workshopName || undefined,
        phone: phone || undefined,
        email,
        password,
      });
      router.replace('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-5"
    >
      <div>
        <p className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
          Company access
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-brand-text">
          Create a customer account
        </h2>
      </div>
      <AuthError message={error} />
      <Field
        id="name"
        label="Contact name"
        value={name}
        required
        autoComplete="name"
        onChange={setName}
      />
      <Field
        id="company"
        label="Company"
        value={companyName}
        autoComplete="organization"
        onChange={setCompanyName}
      />
      <Field id="workshop" label="Workshop" value={workshopName} onChange={setWorkshopName} />
      <Field
        id="phone"
        label="Phone"
        type="tel"
        value={phone}
        autoComplete="tel"
        onChange={setPhone}
      />
      <Field
        id="email"
        label="Email"
        type="email"
        value={email}
        required
        autoComplete="email"
        onChange={setEmail}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="password"
          label="Password"
          type="password"
          value={password}
          required
          autoComplete="new-password"
          onChange={setPassword}
        />
        <Field
          id="confirm-password"
          label="Confirm"
          type="password"
          value={confirmPassword}
          required
          autoComplete="new-password"
          onChange={setConfirmPassword}
        />
      </div>
      <SubmitButton pending={pending} idle="Create account" busy="Creating account..." />
      <p className="text-sm text-brand-muted">
        Already registered?{' '}
        <Link
          href="/login"
          className="font-semibold text-brand-orange hover:text-brand-orange-soft"
        >
          Login
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setResetUrl('');
    setPending(true);

    try {
      const response = await requestPasswordReset(email);
      setMessage('If the account exists, reset instructions are now ready.');
      if (response.resetUrl) setResetUrl(response.resetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset request failed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-5"
    >
      <div>
        <p className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
          Account recovery
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-brand-text">Reset access</h2>
      </div>
      <AuthError message={error} />
      {message && (
        <div className="rounded-lg border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm text-brand-text">
          {message}
          {resetUrl && (
            <Link href={resetUrl} className="mt-2 block font-semibold text-brand-orange">
              Open reset link
            </Link>
          )}
        </div>
      )}
      <Field
        id="email"
        label="Email"
        type="email"
        value={email}
        required
        autoComplete="email"
        onChange={setEmail}
      />
      <SubmitButton pending={pending} idle="Request reset" busy="Sending..." />
      <Link
        href="/login"
        className="block text-sm font-semibold text-brand-orange hover:text-brand-orange-soft"
      >
        Back to login
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Reset token is missing.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setPending(true);

    try {
      await resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm text-brand-text">
          Password updated. Login again to restore your account session.
        </div>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="w-full rounded-lg bg-brand-orange px-4 py-3 text-sm font-semibold text-white"
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-5"
    >
      <div>
        <p className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
          New password
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-brand-text">Restore account</h2>
      </div>
      <AuthError message={error} />
      <Field
        id="password"
        label="Password"
        type="password"
        value={password}
        required
        autoComplete="new-password"
        onChange={setPassword}
      />
      <Field
        id="confirm-password"
        label="Confirm"
        type="password"
        value={confirmPassword}
        required
        autoComplete="new-password"
        onChange={setConfirmPassword}
      />
      <SubmitButton pending={pending} idle="Update password" busy="Updating..." />
    </form>
  );
}
