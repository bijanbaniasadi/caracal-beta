'use client';

import type { BinUploadStatus, IntakeStatus } from '@/lib/api/types';

// ─── Intake status ────────────────────────────────────────────────────────────

const intakeClasses: Record<IntakeStatus, string> = {
  NEW:        'bg-blue-100  text-blue-800',
  IN_REVIEW:  'bg-yellow-100 text-yellow-800',
  RESPONDED:  'bg-green-100 text-green-800',
  CLOSED:     'bg-gray-100  text-gray-600',
  SPAM:       'bg-red-100   text-red-700',
};

const intakeLabels: Record<IntakeStatus, string> = {
  NEW:        'New',
  IN_REVIEW:  'In Review',
  RESPONDED:  'Responded',
  CLOSED:     'Closed',
  SPAM:       'Spam',
};

// ─── Upload status ────────────────────────────────────────────────────────────

const uploadClasses: Record<BinUploadStatus, string> = {
  RECEIVED:  'bg-blue-100  text-blue-800',
  VALIDATED: 'bg-green-100 text-green-800',
  REJECTED:  'bg-red-100   text-red-700',
  STORED:    'bg-emerald-100 text-emerald-800',
};

const uploadLabels: Record<BinUploadStatus, string> = {
  RECEIVED:  'Received',
  VALIDATED: 'Validated',
  REJECTED:  'Rejected',
  STORED:    'Stored',
};

// ─── Components ───────────────────────────────────────────────────────────────

const BASE = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';

export function IntakeStatusBadge({ status }: { status: IntakeStatus }) {
  return (
    <span className={`${BASE} ${intakeClasses[status]}`}>
      {intakeLabels[status]}
    </span>
  );
}

export function UploadStatusBadge({ status }: { status: BinUploadStatus }) {
  return (
    <span className={`${BASE} ${uploadClasses[status]}`}>
      {uploadLabels[status]}
    </span>
  );
}
