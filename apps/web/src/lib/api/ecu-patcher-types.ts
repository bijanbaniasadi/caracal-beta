export type EcuPatcherAccessStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type EcuPatcherModule = 'DCM71B_DPF' | 'DCM71B_EGR' | 'SID208_DPF_EGR' | 'DTC_REMOVER';
export type EcuPatcherJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'REJECTED';

export interface EcuPatcherAccess {
  hasAccess: boolean;
  status: EcuPatcherAccessStatus | null;
  amountCents: number;
  currency: string;
  notes: string | null;
  approvedAt: string | null;
  requestedAt: string | null;
}

export interface EcuPatcherJob {
  id: string;
  module: EcuPatcherModule;
  status: EcuPatcherJobStatus;
  originalFileName: string;
  originalByteSize: number;
  originalSha256: string;
  resultFileName: string | null;
  resultByteSize: number | null;
  resultSha256: string | null;
  patches: {
    total: number;
    ready: number;
    applied: number;
    alreadyApplied: number;
    mismatched: number;
  };
  checksum: {
    applied: boolean;
    offset: number | null;
    value: string | null;
  };
  failure: {
    code: string;
    message: string | null;
  } | null;
  logs: Array<{ level: 'info' | 'ok' | 'warn' | 'error'; message: string }> | null;
  downloadUrl: string | null;
  upload: {
    id: string;
    originalFileName: string;
    status: string;
    createdAt: string;
  } | null;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EcuPatcherModuleConfig {
  module: EcuPatcherModule;
  label: string;
  expectedFileSize: number | null;
  suffix: string;
  checksumSupported: boolean;
}
