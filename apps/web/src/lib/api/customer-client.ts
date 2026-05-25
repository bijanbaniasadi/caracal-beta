import type {
  AccountInquiries,
  AccountSummary,
  ChangePasswordInput,
  CustomerOrder,
  CustomerSession,
  CustomerUpload,
  CustomerUser,
  ForgotPasswordResponse,
  LoginInput,
  LoginResponse,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from './customer-types';

const SESSION_KEY = 'caracal_customer_session';
const REFRESH_KEY = 'caracal_customer_refresh';
export const CUSTOMER_AUTH_COOKIE = 'caracal_customer_session';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
  };
}

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

function setAuthMarker(expiresAt?: string): void {
  if (typeof document === 'undefined') return;
  const expiryMs = expiresAt
    ? new Date(expiresAt).getTime()
    : Date.now() + 30 * 24 * 60 * 60 * 1000;
  const maxAge = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
  document.cookie = `${CUSTOMER_AUTH_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearAuthMarker(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${CUSTOMER_AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function getStoredCustomerSession(): CustomerSession | null {
  const session = readJson<CustomerSession>(SESSION_KEY);
  if (!session) return null;

  if (new Date(session.accessTokenExpiresAt) <= new Date()) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }

  return session;
}

function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function storeCustomerSession(loginResponse: LoginResponse): CustomerSession {
  const session: CustomerSession = {
    accessToken: loginResponse.accessToken,
    accessTokenExpiresAt: loginResponse.accessTokenExpiresAt,
    user: loginResponse.user,
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(REFRESH_KEY, loginResponse.refreshToken);
  setAuthMarker(loginResponse.refreshTokenExpiresAt);
  return session;
}

export function updateStoredCustomerUser(user: CustomerUser): CustomerSession | null {
  const session = getStoredCustomerSession();
  if (!session) return null;

  const next = { ...session, user };
  localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  return next;
}

export function clearCustomerSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REFRESH_KEY);
  clearAuthMarker();
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Server returned HTTP ${response.status}`);
  }

  if (!response.ok || !envelope.success) {
    throw new Error(envelope.error?.message ?? `HTTP ${response.status}`);
  }

  return envelope;
}

async function refreshCustomerAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${getApiBase()}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });
    const envelope = await parseEnvelope<LoginResponse>(response);
    const session = storeCustomerSession(envelope.data);
    return session.accessToken;
  } catch {
    clearCustomerSession();
    return null;
  }
}

let refreshing: Promise<string | null> | null = null;

async function getAccessToken(): Promise<string | null> {
  const session = getStoredCustomerSession();
  if (session) return session.accessToken;

  if (!refreshing) {
    refreshing = refreshCustomerAccessToken().finally(() => {
      refreshing = null;
    });
  }

  return refreshing;
}

async function customerFetch<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  retry = true
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshCustomerAccessToken();
    if (refreshed) return customerFetch<T>(method, path, body, false);
  }

  const envelope = await parseEnvelope<T>(response);
  return envelope.data;
}

async function publicAuthPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const envelope = await parseEnvelope<T>(response);
  return envelope.data;
}

export async function customerLogin(input: LoginInput): Promise<CustomerSession> {
  const loginResponse = await publicAuthPost<LoginResponse>('/api/auth/login', input);
  return storeCustomerSession(loginResponse);
}

export async function customerRegister(input: RegisterInput): Promise<CustomerSession> {
  const loginResponse = await publicAuthPost<LoginResponse>('/api/auth/register', input);
  return storeCustomerSession(loginResponse);
}

export async function customerLogout(): Promise<void> {
  try {
    await customerFetch<{ loggedOut: boolean }>('POST', '/api/auth/logout', {});
  } catch {
    // Logout should always clear local state even if the network is unavailable.
  }
  clearCustomerSession();
}

export async function restoreCustomerSession(): Promise<CustomerSession | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const data = await customerFetch<{ user: CustomerUser }>('GET', '/api/auth/session');
    const stored = getStoredCustomerSession();
    if (!stored) return null;
    const next = { ...stored, user: data.user };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    return next;
  } catch {
    clearCustomerSession();
    return null;
  }
}

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  return publicAuthPost<ForgotPasswordResponse>('/api/auth/forgot-password', { email });
}

export async function resetPassword(input: ResetPasswordInput): Promise<{ reset: boolean }> {
  return publicAuthPost<{ reset: boolean }>('/api/auth/reset-password', input);
}

export async function getAccountSummary(): Promise<AccountSummary> {
  return customerFetch<AccountSummary>('GET', '/api/account/summary');
}

export async function getAccountOrders(): Promise<CustomerOrder[]> {
  return customerFetch<CustomerOrder[]>('GET', '/api/account/orders?limit=100');
}

export async function getAccountInquiries(): Promise<AccountInquiries> {
  return customerFetch<AccountInquiries>('GET', '/api/account/inquiries?limit=100');
}

export async function getAccountUploads(): Promise<CustomerUpload[]> {
  return customerFetch<CustomerUpload[]>('GET', '/api/account/uploads?limit=100');
}

export async function updateAccountProfile(input: UpdateProfileInput): Promise<CustomerUser> {
  const data = await customerFetch<{ user: CustomerUser }>('PATCH', '/api/account/profile', input);
  updateStoredCustomerUser(data.user);
  return data.user;
}

export async function changeAccountPassword(input: ChangePasswordInput): Promise<void> {
  await customerFetch<{ changed: boolean }>('PATCH', '/api/account/password', input);
  clearCustomerSession();
}
