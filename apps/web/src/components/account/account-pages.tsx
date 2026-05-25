'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useCustomerAuth } from '@/contexts/customer-auth';
import {
  changeAccountPassword,
  getAccountInquiries,
  getAccountOrders,
  getAccountSummary,
  getAccountUploads,
  updateAccountProfile,
} from '@/lib/api/customer-client';
import type {
  AccountInquiries,
  AccountSummary,
  CustomerOrder,
  CustomerUpload,
  ProductInquiryRecord,
  QuoteRequestRecord,
} from '@/lib/api/customer-types';

const panelClass = 'rounded-lg border border-white/10 bg-white/[0.04] p-5';
const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50 focus:ring-1 focus:ring-brand-orange/30';

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not yet';
  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatAed(cents: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
  }).format(cents / 100);
}

function StatusBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-brand-muted">
      {children.replaceAll('_', ' ')}
    </span>
  );
}

function LoadingPanel() {
  return <div className="h-44 animate-pulse rounded-lg border border-white/10 bg-white/5" />;
}

function EmptyState({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
      <h2 className="font-display text-xl font-bold text-brand-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-brand-muted">{body}</p>
      {href && action && (
        <Link
          href={href}
          className="mt-5 inline-flex rounded-md bg-brand-orange px-4 py-2 text-sm font-semibold text-white"
        >
          {action}
        </Link>
      )}
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-display text-2xl font-bold text-brand-text">{title}</h2>
    </div>
  );
}

function OrderRow({ order }: { order: CustomerOrder }) {
  return (
    <article className={panelClass}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-mono text-sm font-semibold text-brand-orange">{order.orderNumber}</p>
          <h3 className="mt-1 font-semibold text-brand-text">
            {order.items.length > 0 ? order.items.map((item) => item.name).join(', ') : 'Order'}
          </h3>
          <p className="mt-2 text-sm text-brand-muted">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <StatusBadge>{order.paymentStatus}</StatusBadge>
          <StatusBadge>{order.fulfillmentStatus}</StatusBadge>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <span className="text-sm text-brand-muted">{order.items.length} item(s)</span>
        <strong className="text-brand-text">{formatAed(order.amounts.totalCents)}</strong>
      </div>
    </article>
  );
}

function QuoteRow({ quote }: { quote: QuoteRequestRecord }) {
  return (
    <article className={panelClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-sm font-semibold text-brand-orange">{quote.referenceCode}</p>
          <h3 className="mt-1 font-semibold text-brand-text">
            {quote.vehicleDetails ?? 'Quote request'}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm text-brand-muted">{quote.message}</p>
        </div>
        <StatusBadge>{quote.status}</StatusBadge>
      </div>
    </article>
  );
}

function ProductInquiryRow({ inquiry }: { inquiry: ProductInquiryRecord }) {
  return (
    <article className={panelClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-sm font-semibold text-brand-orange">
            {inquiry.referenceCode}
          </p>
          <h3 className="mt-1 font-semibold text-brand-text">{inquiry.productName}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-brand-muted">{inquiry.message}</p>
        </div>
        <StatusBadge>{inquiry.status}</StatusBadge>
      </div>
    </article>
  );
}

function UploadRow({ upload }: { upload: CustomerUpload }) {
  const latestJob = upload.analysisJobs[0];

  return (
    <article className={panelClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-semibold text-brand-text">{upload.originalFileName}</p>
          <p className="mt-1 font-mono text-xs text-brand-muted">{upload.sha256.slice(0, 24)}...</p>
          <p className="mt-2 text-sm text-brand-muted">{formatDate(upload.createdAt)}</p>
        </div>
        <StatusBadge>{upload.status}</StatusBadge>
      </div>
      {latestJob && (
        <div className="mt-4 rounded-lg border border-white/10 bg-brand-deep/70 p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-brand-text">
              {latestJob.stage.replaceAll('_', ' ')}
            </span>
            <span className="text-brand-muted">{latestJob.progress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-brand-orange" style={{ width: `${latestJob.progress}%` }} />
          </div>
        </div>
      )}
    </article>
  );
}

export function AccountDashboard() {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAccountSummary()
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <EmptyState title="Dashboard unavailable" body={error} />;
  if (!summary) return <LoadingPanel />;

  const cards = [
    ['Orders', summary.counts.orders, '/account/orders'],
    ['Quote requests', summary.counts.quoteRequests, '/account/inquiries'],
    ['Product inquiries', summary.counts.productInquiries, '/account/inquiries'],
    ['BIN uploads', summary.counts.uploads, '/account/uploads'],
  ] as const;

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, href]) => (
          <Link key={label} href={href} className={panelClass}>
            <p className="text-sm text-brand-muted">{label}</p>
            <strong className="mt-2 block font-display text-3xl text-brand-text">{value}</strong>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Recent orders" title="Commercial purchases" />
          <div className="space-y-3">
            {summary.recent.orders.length > 0 ? (
              summary.recent.orders.map((order) => <OrderRow key={order.id} order={order} />)
            ) : (
              <EmptyState
                title="No orders yet"
                body="Orders placed with this account email will appear here."
                href="/shop"
                action="Browse shop"
              />
            )}
          </div>
        </div>

        <div>
          <SectionHeader eyebrow="Recent activity" title="Support workflow" />
          <div className="space-y-3">
            {summary.recent.quoteRequests.map((quote) => (
              <QuoteRow key={quote.id} quote={quote} />
            ))}
            {summary.recent.productInquiries.map((inquiry) => (
              <ProductInquiryRow key={inquiry.id} inquiry={inquiry} />
            ))}
            {summary.recent.quoteRequests.length === 0 &&
              summary.recent.productInquiries.length === 0 && (
                <EmptyState
                  title="No inquiries yet"
                  body="Quote requests and product inquiries tied to this email will appear here."
                  href="/contact"
                  action="Start inquiry"
                />
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAccountOrders()
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load orders.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <EmptyState title="Orders unavailable" body={error} />;
  if (!orders) return <LoadingPanel />;

  return (
    <div>
      <SectionHeader eyebrow="Orders" title="Order history" />
      <div className="space-y-3">
        {orders.length > 0 ? (
          orders.map((order) => <OrderRow key={order.id} order={order} />)
        ) : (
          <EmptyState
            title="No orders yet"
            body="Stripe checkout orders tied to your account email will appear here."
            href="/shop"
            action="Browse shop"
          />
        )}
      </div>
    </div>
  );
}

export function AccountInquiriesPage() {
  const [inquiries, setInquiries] = useState<AccountInquiries | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAccountInquiries()
      .then((data) => {
        if (active) setInquiries(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load inquiries.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <EmptyState title="Inquiries unavailable" body={error} />;
  if (!inquiries) return <LoadingPanel />;

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader eyebrow="Quote requests" title="Workshop and vehicle requests" />
        <div className="space-y-3">
          {inquiries.quoteRequests.length > 0 ? (
            inquiries.quoteRequests.map((quote) => <QuoteRow key={quote.id} quote={quote} />)
          ) : (
            <EmptyState
              title="No quote requests"
              body="Quote requests submitted with your email will appear here."
            />
          )}
        </div>
      </div>

      <div>
        <SectionHeader eyebrow="Product inquiries" title="Catalog questions" />
        <div className="space-y-3">
          {inquiries.productInquiries.length > 0 ? (
            inquiries.productInquiries.map((inquiry) => (
              <ProductInquiryRow key={inquiry.id} inquiry={inquiry} />
            ))
          ) : (
            <EmptyState
              title="No product inquiries"
              body="Product inquiries submitted with your email will appear here."
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function AccountUploadsPage() {
  const [uploads, setUploads] = useState<CustomerUpload[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAccountUploads()
      .then((data) => {
        if (active) setUploads(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load uploads.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <EmptyState title="Uploads unavailable" body={error} />;
  if (!uploads) return <LoadingPanel />;

  return (
    <div>
      <SectionHeader eyebrow="BIN uploads" title="Uploaded file visibility" />
      <div className="space-y-3">
        {uploads.length > 0 ? (
          uploads.map((upload) => <UploadRow key={upload.id} upload={upload} />)
        ) : (
          <EmptyState
            title="No uploads yet"
            body="Accepted BIN uploads tied to this email will appear here with processing status."
            href="/contact"
            action="Open contact"
          />
        )}
      </div>
    </div>
  );
}

export function AccountSettingsPage() {
  const { session, setSession } = useCustomerAuth();
  const [name, setName] = useState(session?.user.name ?? '');
  const [phone, setPhone] = useState(session?.user.phone ?? '');
  const [companyName, setCompanyName] = useState(session?.user.companyName ?? '');
  const [workshopName, setWorkshopName] = useState(session?.user.workshopName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingProfile, setPendingProfile] = useState(false);
  const [pendingPassword, setPendingPassword] = useState(false);

  const canSaveProfile = useMemo(() => name.trim().length > 0, [name]);

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setPendingProfile(true);

    try {
      const user = await updateAccountProfile({
        name,
        phone: phone || null,
        companyName: companyName || null,
        workshopName: workshopName || null,
      });
      if (session) setSession({ ...session, user });
      setMessage('Profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile update failed.');
    } finally {
      setPendingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setPendingPassword(true);

    try {
      await changeAccountPassword({ currentPassword, newPassword });
      setSession(null);
      setMessage('Password changed. Please login again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed.');
    } finally {
      setPendingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Settings" title="Profile and password" />

      {(message || error) && (
        <div
          className={[
            'rounded-lg border px-4 py-3 text-sm',
            error
              ? 'border-red-500/30 bg-red-500/10 text-red-300'
              : 'border-brand-green/30 bg-brand-green/10 text-brand-text',
          ].join(' ')}
        >
          {error || message}
        </div>
      )}

      <form
        onSubmit={(event) => {
          void handleProfileSubmit(event);
        }}
        className={panelClass}
      >
        <h3 className="font-semibold text-brand-text">Profile</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-brand-muted">
            Contact name
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="text-sm text-brand-muted">
            Phone
            <input
              className={inputClass}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <label className="text-sm text-brand-muted">
            Company
            <input
              className={inputClass}
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </label>
          <label className="text-sm text-brand-muted">
            Workshop
            <input
              className={inputClass}
              value={workshopName}
              onChange={(event) => setWorkshopName(event.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={!canSaveProfile || pendingProfile}
          className="mt-5 rounded-md bg-brand-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pendingProfile ? 'Saving...' : 'Save profile'}
        </button>
      </form>

      <form
        onSubmit={(event) => {
          void handlePasswordSubmit(event);
        }}
        className={panelClass}
      >
        <h3 className="font-semibold text-brand-text">Password</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <input
            className={inputClass}
            type="password"
            placeholder="Current password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <input
            className={inputClass}
            type="password"
            placeholder="New password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <input
            className={inputClass}
            type="password"
            placeholder="Confirm password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={pendingPassword || !currentPassword || !newPassword || !confirmPassword}
          className="mt-5 rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-brand-text disabled:opacity-50"
        >
          {pendingPassword ? 'Updating...' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
