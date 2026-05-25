import 'dotenv/config';

import { rm } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apiBase = (
  process.env.CUSTOMER_ACCOUNT_API_URL ??
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001'
).replace(/\/$/, '');

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
  };
}

interface LoginResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  tokenType: 'Bearer';
  user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    companyName: string | null;
    workshopName: string | null;
    role: string;
  };
}

interface AccountSummary {
  counts: {
    orders: number;
    quoteRequests: number;
    productInquiries: number;
    uploads: number;
  };
  user: {
    email: string;
    name: string | null;
    companyName: string | null;
    workshopName: string | null;
  };
}

const requestIds = new Set<string>();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function localUploadPath(storedObjectKey: string): string {
  const uploadRoot = process.env.LOCAL_UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads');
  return path.join(uploadRoot, storedObjectKey);
}

function recordRequestId(envelope: ApiEnvelope<unknown>): void {
  if (envelope.meta?.requestId) {
    requestIds.add(envelope.meta.requestId);
  }
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const envelope = (await response.json()) as ApiEnvelope<T>;
  recordRequestId(envelope);
  return envelope;
}

async function waitForApi(): Promise<void> {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(`${apiBase}/health/live`);
      if (response.ok) return;
    } catch {
      // Keep polling while a local dev server is still booting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`API did not become available at ${apiBase}`);
}

async function requestJson<T>(params: {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: unknown;
  token?: string;
  expectedStatus?: number;
}): Promise<{ data: T; envelope: ApiEnvelope<T>; status: number }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (params.body !== undefined) headers['Content-Type'] = 'application/json';
  if (params.token) headers.Authorization = `Bearer ${params.token}`;

  const response = await fetch(`${apiBase}${params.path}`, {
    method: params.method,
    headers,
    body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
  });
  const envelope = await parseEnvelope<T>(response);
  const expectedStatus = params.expectedStatus ?? 200;

  assert(
    response.status === expectedStatus,
    `${params.method} ${params.path} returned ${response.status}, expected ${expectedStatus}: ${
      envelope.error?.message ?? 'no error message'
    }`
  );
  assert(envelope.success, `${params.method} ${params.path} failed: ${envelope.error?.message}`);
  assert(envelope.data !== undefined, `${params.method} ${params.path} returned no data`);

  return { data: envelope.data, envelope, status: response.status };
}

async function requestExpectedError(params: {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  token?: string;
  expectedStatus: number;
}): Promise<ApiEnvelope<unknown>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (params.token) headers.Authorization = `Bearer ${params.token}`;

  const response = await fetch(`${apiBase}${params.path}`, {
    method: params.method,
    headers,
  });
  const envelope = await parseEnvelope<unknown>(response);

  assert(
    response.status === params.expectedStatus,
    `${params.method} ${params.path} returned ${response.status}, expected ${params.expectedStatus}`
  );
  assert(!envelope.success, `${params.method} ${params.path} unexpectedly succeeded`);

  return envelope;
}

async function uploadValidationBin(email: string): Promise<{ id: string; status: string }> {
  const form = new FormData();
  form.append('requesterName', 'Validation Customer');
  form.append('requesterEmail', email);
  form.append('productContext', 'Customer account validation');
  form.append('notes', 'Runtime validation upload; safe synthetic bytes.');
  form.append(
    'file',
    new Blob([new Uint8Array([0x42, 0x49, 0x4e, 0x00, 0x11, 0x22, 0x33, 0x44])], {
      type: 'application/octet-stream',
    }),
    'customer-account-validation.bin'
  );

  const response = await fetch(`${apiBase}/api/bin-uploads`, {
    method: 'POST',
    body: form,
  });
  const envelope = await parseEnvelope<{ id: string; status: string }>(response);

  assert(response.status === 201, `BIN upload returned ${response.status}`);
  assert(envelope.success && envelope.data, `BIN upload failed: ${envelope.error?.message}`);

  return envelope.data;
}

async function cleanupValidationRecords(emailPrefix = 'customer-validation-'): Promise<void> {
  const [users, quoteEmails, inquiryEmails, uploadEmails, orderEmails] = await Promise.all([
    prisma.user.findMany({
      where: { email: { startsWith: emailPrefix } },
      select: { id: true, email: true },
    }),
    prisma.quoteRequest.findMany({
      where: { customerEmail: { startsWith: emailPrefix } },
      select: { customerEmail: true },
    }),
    prisma.productInquiry.findMany({
      where: { customerEmail: { startsWith: emailPrefix } },
      select: { customerEmail: true },
    }),
    prisma.binUpload.findMany({
      where: { requesterEmail: { startsWith: emailPrefix } },
      select: { requesterEmail: true },
    }),
    prisma.order.findMany({
      where: { customerEmail: { startsWith: emailPrefix } },
      select: { customerEmail: true },
    }),
  ]);
  const emails = Array.from(
    new Set([
      ...users.map((user) => user.email),
      ...quoteEmails.map((row) => row.customerEmail),
      ...inquiryEmails.map((row) => row.customerEmail),
      ...uploadEmails.flatMap((row) => (row.requesterEmail ? [row.requesterEmail] : [])),
      ...orderEmails.flatMap((row) => (row.customerEmail ? [row.customerEmail] : [])),
    ])
  );
  const userIds = users.map((user) => user.id);

  if (emails.length === 0 && userIds.length === 0) return;

  const [orders, quoteRequests, productInquiries, uploads, resetTokens] = await Promise.all([
    prisma.order.findMany({
      where: { OR: [{ userId: { in: userIds } }, { customerEmail: { in: emails } }] },
      select: { id: true },
    }),
    prisma.quoteRequest.findMany({
      where: { customerEmail: { in: emails } },
      select: { id: true },
    }),
    prisma.productInquiry.findMany({
      where: { customerEmail: { in: emails } },
      select: { id: true },
    }),
    prisma.binUpload.findMany({
      where: { requesterEmail: { in: emails } },
      select: { id: true, storedObjectKey: true, storageProvider: true },
    }),
    prisma.passwordResetToken.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    }),
  ]);

  const entityIds = [
    ...userIds,
    ...orders.map((row) => row.id),
    ...quoteRequests.map((row) => row.id),
    ...productInquiries.map((row) => row.id),
    ...uploads.map((row) => row.id),
    ...resetTokens.map((row) => row.id),
  ];

  await prisma.auditLog.deleteMany({
    where: {
      OR: [{ actorId: { in: userIds } }, { entityId: { in: entityIds } }],
    },
  });
  await prisma.order.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { customerEmail: { in: emails } }] },
  });
  await prisma.binUpload.deleteMany({ where: { requesterEmail: { in: emails } } });
  await prisma.quoteRequest.deleteMany({ where: { customerEmail: { in: emails } } });
  await prisma.productInquiry.deleteMany({ where: { customerEmail: { in: emails } } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  for (const upload of uploads) {
    if (upload.storageProvider !== 'LOCAL') continue;
    await rm(localUploadPath(upload.storedObjectKey), { force: true });
  }
}

async function main(): Promise<void> {
  await waitForApi();
  await cleanupValidationRecords();

  const startedAt = new Date();
  const stamp = Date.now();
  const email = `customer-validation-${stamp}@example.test`;
  const initialPassword = `Validation-${stamp}!`;
  const resetPassword = `Restored-${stamp}!`;

  try {
    await requestExpectedError({
      method: 'GET',
      path: '/api/account/summary',
      expectedStatus: 401,
    });

    const register = await requestJson<LoginResponse>({
      method: 'POST',
      path: '/api/auth/register',
      expectedStatus: 201,
      body: {
        email,
        password: initialPassword,
        name: 'Validation Customer',
        phone: '+971500000000',
        companyName: 'Validation Garage LLC',
        workshopName: 'Validation Tuning Bay',
      },
    });
    assert(register.data.user.role === 'customer', 'Registered user was not a customer role');

    const refresh = await requestJson<LoginResponse>({
      method: 'POST',
      path: '/api/auth/refresh',
      body: { refreshToken: register.data.refreshToken },
    });
    assert(
      refresh.data.refreshToken !== register.data.refreshToken,
      'Refresh token did not rotate'
    );

    await requestJson<{ user: LoginResponse['user'] }>({
      method: 'GET',
      path: '/api/auth/session',
      token: refresh.data.accessToken,
    });

    const profile = await requestJson<{ user: LoginResponse['user'] }>({
      method: 'PATCH',
      path: '/api/account/profile',
      token: refresh.data.accessToken,
      body: {
        name: 'Validation Customer Updated',
        phone: '+971500000001',
        companyName: 'Validation Garage Updated LLC',
        workshopName: 'Validation Bay 2',
      },
    });
    assert(
      profile.data.user.companyName === 'Validation Garage Updated LLC',
      'Profile company was not persisted'
    );

    const quoteRequest = await requestJson<{ id: string; referenceCode: string }>({
      method: 'POST',
      path: '/api/quote-requests',
      expectedStatus: 201,
      body: {
        customerName: 'Validation Customer Updated',
        customerEmail: email,
        customerPhone: '+971500000001',
        companyName: 'Validation Garage Updated LLC',
        workshopName: 'Validation Bay 2',
        vehicleDetails: 'BMW F-series validation vehicle',
        requestedItems: ['ECU remapping quote', 'Bench read support'],
        message: 'Runtime validation quote request.',
        source: 'customer_account_validation',
      },
    });

    const productInquiry = await requestJson<{ id: string; referenceCode: string }>({
      method: 'POST',
      path: '/api/product-inquiries',
      expectedStatus: 201,
      body: {
        productName: 'KESS3 customer validation inquiry',
        customerName: 'Validation Customer Updated',
        customerEmail: email,
        customerPhone: '+971500000001',
        companyName: 'Validation Garage Updated LLC',
        quantity: 1,
        message: 'Runtime validation product inquiry.',
        source: 'customer_account_validation',
      },
    });

    const upload = await uploadValidationBin(email);
    const userId = register.data.user.id;
    const order = await prisma.order.create({
      data: {
        orderNumber: `CTM-VALID-${stamp}`,
        userId,
        customerEmail: email,
        customerName: 'Validation Customer Updated',
        customerPhone: '+971500000001',
        subtotalCents: 325000,
        shippingCents: 0,
        totalCents: 325000,
        status: 'PAID',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'PROCESSING',
        metadata: { source: 'customer_account_validation' },
        items: {
          create: [
            {
              sku: 'VALID-ACCOUNT',
              slug: 'validation-account-order',
              name: 'Customer account validation order',
              quantity: 1,
              unitPriceCents: 325000,
              lineTotalCents: 325000,
              currency: 'AED',
              metadata: { source: 'customer_account_validation' },
            },
          ],
        },
        payments: {
          create: {
            provider: 'MANUAL',
            status: 'PAID',
            amountCents: 325000,
            currency: 'AED',
            paidAt: new Date(),
            metadata: { source: 'customer_account_validation' },
          },
        },
      },
      select: { id: true, orderNumber: true },
    });

    const summary = await requestJson<AccountSummary>({
      method: 'GET',
      path: '/api/account/summary',
      token: refresh.data.accessToken,
    });
    assert(summary.data.counts.orders >= 1, 'Account summary did not include order history');
    assert(
      summary.data.counts.quoteRequests >= 1,
      'Account summary did not include quote requests'
    );
    assert(
      summary.data.counts.productInquiries >= 1,
      'Account summary did not include product inquiries'
    );
    assert(summary.data.counts.uploads >= 1, 'Account summary did not include BIN uploads');

    const orders = await requestJson<unknown[]>({
      method: 'GET',
      path: '/api/account/orders',
      token: refresh.data.accessToken,
    });
    const inquiries = await requestJson<{ quoteRequests: unknown[]; productInquiries: unknown[] }>({
      method: 'GET',
      path: '/api/account/inquiries',
      token: refresh.data.accessToken,
    });
    const uploads = await requestJson<unknown[]>({
      method: 'GET',
      path: '/api/account/uploads',
      token: refresh.data.accessToken,
    });

    assert(orders.data.length >= 1, 'Order list was empty');
    assert(inquiries.data.quoteRequests.length >= 1, 'Quote request list was empty');
    assert(inquiries.data.productInquiries.length >= 1, 'Product inquiry list was empty');
    assert(uploads.data.length >= 1, 'Upload list was empty');

    const forgot = await requestJson<{ accepted: true; resetUrl?: string }>({
      method: 'POST',
      path: '/api/auth/forgot-password',
      body: { email },
    });
    assert(
      forgot.data.resetUrl,
      'Password reset URL was not exposed; set AUTH_EXPOSE_RESET_TOKEN=true for local validation'
    );
    const resetToken = new URL(forgot.data.resetUrl).searchParams.get('token');
    assert(resetToken, 'Password reset URL did not include a token');

    await requestJson<{ reset: boolean }>({
      method: 'POST',
      path: '/api/auth/reset-password',
      body: { token: resetToken, password: resetPassword },
    });

    const restoredLogin = await requestJson<LoginResponse>({
      method: 'POST',
      path: '/api/auth/login',
      body: { email, password: resetPassword },
    });
    assert(restoredLogin.data.user.id === userId, 'Password reset login restored wrong user');

    await requestJson<{ loggedOut: boolean }>({
      method: 'POST',
      path: '/api/auth/logout',
      body: { refreshToken: restoredLogin.data.refreshToken },
    });

    const requiredAuditActions = [
      'auth.register.succeeded',
      'auth.password_reset.requested',
      'auth.password_reset.completed',
      'quote_request.created',
      'product_inquiry.created',
      'bin_upload.created',
      'account.profile.updated',
      'account.orders.listed',
      'account.inquiries.listed',
      'account.uploads.listed',
    ];
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        createdAt: { gte: startedAt },
        action: { in: requiredAuditActions },
      },
      select: { action: true },
    });
    const auditActions = new Set(auditLogs.map((row) => row.action));
    const missingAuditActions = requiredAuditActions.filter((action) => !auditActions.has(action));
    assert(
      missingAuditActions.length === 0,
      `Missing audit actions: ${missingAuditActions.join(', ')}`
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          apiBase,
          user: {
            id: userId,
            email,
            role: register.data.user.role,
            companyName: summary.data.user.companyName,
            workshopName: summary.data.user.workshopName,
          },
          created: {
            order,
            quoteRequest,
            productInquiry,
            upload,
          },
          counts: summary.data.counts,
          validations: {
            protectedRoute401: true,
            refreshTokenRotated: true,
            sessionRestore: true,
            profilePersistence: true,
            historyVisibility: true,
            passwordReset: true,
            logout: true,
            auditActions: requiredAuditActions,
            structuredResponsesWithRequestIds: requestIds.size,
          },
        },
        null,
        2
      )
    );
  } finally {
    await cleanupValidationRecords();
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
