import { getStoredCustomerSession, restoreCustomerSession } from './customer-client';
import type {
  EcuPatcherAccess,
  EcuPatcherJob,
  EcuPatcherModule,
  EcuPatcherModuleConfig,
} from './ecu-patcher-types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

async function getAccessToken(): Promise<string> {
  const stored = getStoredCustomerSession();
  if (stored?.accessToken) return stored.accessToken;

  const restored = await restoreCustomerSession();
  if (restored?.accessToken) return restored.accessToken;

  throw new Error('Please sign in to use the ECU patcher.');
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const envelope = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !envelope.success) {
    throw new Error(envelope.error?.message ?? `HTTP ${response.status}`);
  }

  return envelope.data;
}

async function patcherJson<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  retry = true
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && retry) {
    await restoreCustomerSession();
    return patcherJson<T>(method, path, body, false);
  }

  return parseEnvelope<T>(response);
}

export function getEcuPatcherModules(): Promise<EcuPatcherModuleConfig[]> {
  return patcherJson<EcuPatcherModuleConfig[]>('GET', '/api/ecu-patcher/modules');
}

export function getEcuPatcherAccess(): Promise<EcuPatcherAccess> {
  return patcherJson<EcuPatcherAccess>('GET', '/api/ecu-patcher/access');
}

export function requestEcuPatcherAccess(notes?: string): Promise<EcuPatcherAccess> {
  return patcherJson<EcuPatcherAccess>('POST', '/api/ecu-patcher/access-requests', { notes });
}

export function listEcuPatcherJobs(): Promise<EcuPatcherJob[]> {
  return patcherJson<EcuPatcherJob[]>('GET', '/api/ecu-patcher/jobs?limit=20');
}

export async function createEcuPatcherJob(input: {
  module: EcuPatcherModule;
  file: File;
  fixChecksum?: boolean;
}): Promise<EcuPatcherJob> {
  const token = await getAccessToken();
  const form = new FormData();
  form.append('module', input.module);
  form.append('fixChecksum', input.fixChecksum === false ? 'false' : 'true');
  form.append('file', input.file);

  const response = await fetch(`${getApiBase()}/api/ecu-patcher/jobs`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    body: form,
  });

  if (response.status === 401) {
    await restoreCustomerSession();
    const retryToken = await getAccessToken();
    const retry = await fetch(`${getApiBase()}/api/ecu-patcher/jobs`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${retryToken}`,
      },
      credentials: 'include',
      body: form,
    });
    return parseEnvelope<EcuPatcherJob>(retry);
  }

  return parseEnvelope<EcuPatcherJob>(response);
}

export async function downloadEcuPatcherResult(job: EcuPatcherJob): Promise<void> {
  if (!job.downloadUrl) {
    throw new Error('No result download is available for this job.');
  }

  const token = await getAccessToken();
  const response = await fetch(`${getApiBase()}${job.downloadUrl}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Download failed with HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = job.resultFileName ?? `${job.id}.bin`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 1000);
}
