'use client';

/**
 * useQuoteRequest — typed mutation hook for POST /api/quote-requests.
 *
 * On success: fires a success toast with the reference code.
 * On error:   fires an error toast; in dev mode the backend request-id is
 *             appended so engineers can correlate with server logs.
 *
 * Usage:
 *   const { submit, isPending, isSuccess, data } = useQuoteRequest();
 *   submit({ customerName: '…', customerEmail: '…', message: '…' });
 */

import { useMutation } from '@tanstack/react-query';

import { CaracalApiError, submitQuoteRequest } from '@/lib/api';
import type { IntakeConfirmation, QuoteRequestInput } from '@/lib/api';
import { useToast } from '@/lib/toast/use-toast';
import { useApiConfig } from '@/providers/api-provider';

export interface UseQuoteRequestReturn {
  /** Fire and forget — errors are surfaced via toast, never thrown. */
  submit: (input: QuoteRequestInput) => void;
  /** Awaitable variant — throws CaracalApiError on failure. */
  submitAsync: (input: QuoteRequestInput) => Promise<IntakeConfirmation>;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  data: IntakeConfirmation | undefined;
  error: Error | null;
  /** Reset mutation state back to idle (does not cancel in-flight requests). */
  reset: () => void;
}

export function useQuoteRequest(): UseQuoteRequestReturn {
  const { isDev } = useApiConfig();
  const { success, error: toastError } = useToast();

  const mutation = useMutation<IntakeConfirmation, Error, QuoteRequestInput>({
    mutationFn: submitQuoteRequest,

    onSuccess(data) {
      success('Quote request submitted', `Reference: ${data.referenceCode}`);
    },

    onError(err) {
      const api = err instanceof CaracalApiError ? err : null;
      const suffix = isDev && api?.requestId ? ` [req: ${api.requestId}]` : '';
      toastError(
        'Failed to submit quote request',
        api
          ? `${api.message}${suffix}`
          : 'An unexpected error occurred. Please try again.',
        api?.requestId,
      );
    },
  });

  return {
    submit: mutation.mutate,
    submitAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}
