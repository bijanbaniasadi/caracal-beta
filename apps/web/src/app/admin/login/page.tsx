'use client';

import { useState, type FormEvent } from 'react';
import { useAdminAuth } from '@/contexts/admin-auth';

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsPending(true);
    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/20">
            <span className="font-display text-2xl font-bold text-brand-orange">C</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-brand-text">
            Caracal Admin
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            Sign in to your workshop dashboard
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-8"
        >
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-muted"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-brand-text placeholder-brand-muted/50 outline-none transition-colors focus:border-brand-orange/50 focus:ring-1 focus:ring-brand-orange/30"
                placeholder="admin@caracaltechmotors.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-muted"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-brand-text placeholder-brand-muted/50 outline-none transition-colors focus:border-brand-orange/50 focus:ring-1 focus:ring-brand-orange/30"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-6 w-full rounded-lg bg-brand-orange px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-brand-muted">
          Admin access only. Not for customer use.
        </p>
      </div>
    </div>
  );
}
