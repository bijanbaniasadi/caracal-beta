'use client';

/**
 * useBinUpload — typed mutation hook for POST /api/bin-uploads.
 *
 * Uses XMLHttpRequest (via uploadBinWithProgress) instead of fetch so that
 * real byte-level upload progress can be tracked and surfaced in the UI.
 *
 * Behaviour:
 *   - progress resets to 0 when a new upload starts.
 *   - progress is set to 100 on success (server-side processing may still run).
 *   - Any in-flight upload is aborted when upload() is called again, or when
 *     the component unmounts.
 *
 * Usage:
 *   const { upload, progress, isPending, isSuccess, data } = useBinUpload();
 *
 *   // Inside a form submit handler:
 *   await upload({ file, requesterEmail: '…', notes: '…' });
 *
 *   // Progress bar:
 *   <progress value={progress} max={100} />
 */

import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CaracalApiError } from '@/lib/api';
import type { BinUploadConfirmation, BinUploadInput } from '@/lib/api';
import { uploadBinWithProgress } from '@/lib/api/upload-client';
import { useToast } from '@/lib/toast/use-toast';
import { useApiConfig } from '@/providers/api-provider';

// ─── Return type ─────────────────────────────────────────────────────────────

export interface UseBinUploadReturn {
  /**
   * Start an upload. Returns a promise that resolves to BinUploadConfirmation
   * on success or rejects with CaracalApiError on failure.
   */
  upload: (input: BinUploadInput) => Promise<BinUploadConfirmation>;
  /**
   * Upload progress 0–100. Resets to 0 when a new upload starts or on error.
   * Jumps to 100 on success.
   */
  progress: number;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  data: BinUploadConfirmation | undefined;
  error: Error | null;
  /**
   * Reset all state back to idle and abort any in-flight upload.
   */
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBinUpload(): UseBinUploadReturn {
  const { isDev } = useApiConfig();
  const { success, error: toastError } = useToast();

  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight upload when the component unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const mutation = useMutation<BinUploadConfirmation, Error, BinUploadInput>({
    mutationFn(input) {
      // Abort any previous upload before starting a new one.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress(0);

      return uploadBinWithProgress(
        input,
        (event) => setProgress(event.percent),
        controller.signal,
      );
    },

    onSuccess(data) {
      setProgress(100);
      success('File uploaded', `Stored: ${data.originalFileName}`);
    },

    onError(err) {
      setProgress(0);
      const api = err instanceof CaracalApiError ? err : null;
      const suffix = isDev && api?.requestId ? ` [req: ${api.requestId}]` : '';
      toastError(
        'Upload failed',
        api
          ? `${api.message}${suffix}`
          : 'Upload failed. Please try again.',
        api?.requestId,
      );
    },
  });

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress(0);
    mutation.reset();
  }, [mutation]);

  return {
    upload: mutation.mutateAsync,
    progress,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    data: mutation.data,
    error: mutation.error,
    reset,
  };
}
