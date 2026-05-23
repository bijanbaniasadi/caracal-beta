/**
 * XHR-based bin-upload client with upload-progress tracking.
 *
 * fetch() has no upload-progress API. XMLHttpRequest's xhr.upload.onprogress
 * gives byte-level progress that is surfaced in the useBinUpload hook.
 *
 * This module is intentionally kept framework-agnostic — it is imported by
 * the hook layer, which owns the React state for progress values.
 */

import { CaracalApiError } from './client';
import type { ApiEnvelope, BinUploadConfirmation, BinUploadInput } from './types';

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

// ─── Progress event ──────────────────────────────────────────────────────────

export interface UploadProgressEvent {
  /** Bytes transferred so far. */
  loaded: number;
  /** Total file size in bytes. */
  total: number;
  /** 0–100, rounded integer. */
  percent: number;
}

// ─── Core upload function ────────────────────────────────────────────────────

/**
 * Uploads a .bin file to POST /api/bin-uploads using XMLHttpRequest so that
 * upload progress can be tracked via the `onProgress` callback.
 *
 * Resolves with the server's BinUploadConfirmation on success.
 * Rejects with a CaracalApiError on network error, API error, or abort.
 *
 * Pass an AbortSignal to cancel in-flight uploads (e.g. on component unmount).
 */
export function uploadBinWithProgress(
  input: BinUploadInput,
  onProgress: (event: UploadProgressEvent) => void,
  signal?: AbortSignal,
): Promise<BinUploadConfirmation> {
  return new Promise((resolve, reject) => {
    // ── Build FormData ────────────────────────────────────────────────────
    const form = new FormData();
    form.append('file', input.file);
    if (input.requesterName !== undefined) form.append('requesterName', input.requesterName);
    if (input.requesterEmail !== undefined) form.append('requesterEmail', input.requesterEmail);
    if (input.productContext !== undefined) form.append('productContext', input.productContext);
    if (input.quoteRequestId !== undefined) form.append('quoteRequestId', input.quoteRequestId);
    if (input.notes !== undefined) form.append('notes', input.notes);

    // ── XHR setup ─────────────────────────────────────────────────────────
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      let body: ApiEnvelope<BinUploadConfirmation>;
      try {
        body = JSON.parse(xhr.responseText) as ApiEnvelope<BinUploadConfirmation>;
      } catch {
        reject(
          new CaracalApiError({
            code: 'internal_server_error',
            message: `Server returned non-JSON response (HTTP ${xhr.status})`,
            status: xhr.status,
          }),
        );
        return;
      }

      if (body.success) {
        resolve(body.data);
      } else {
        reject(
          new CaracalApiError({
            code: body.error.code,
            message: body.error.message,
            status: xhr.status,
            details: body.error.details,
            requestId: body.meta?.requestId,
          }),
        );
      }
    });

    xhr.addEventListener('error', () => {
      reject(
        new CaracalApiError({
          code: 'internal_server_error',
          message: 'Network error during upload',
          status: 0,
        }),
      );
    });

    xhr.addEventListener('abort', () => {
      reject(
        new CaracalApiError({
          code: 'internal_server_error',
          message: 'Upload aborted',
          status: 0,
        }),
      );
    });

    xhr.open('POST', `${getApiBase()}/api/bin-uploads`);
    xhr.setRequestHeader('Accept', 'application/json');
    // Note: do NOT set Content-Type — the browser sets it with the correct
    // multipart boundary when we pass a FormData to xhr.send().

    // ── Abort signal wiring ───────────────────────────────────────────────
    if (signal) {
      if (signal.aborted) {
        // Already cancelled before we even started — reject immediately
        reject(
          new CaracalApiError({
            code: 'internal_server_error',
            message: 'Upload aborted',
            status: 0,
          }),
        );
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });
}
