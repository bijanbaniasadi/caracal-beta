'use client';

/**
 * useProductInquiry — typed mutation hook for POST /api/product-inquiries.
 *
 * On success: fires a success toast with the reference code.
 * On error:   fires an error toast; in dev mode the backend request-id is
 *             surfaced for log correlation.
 *
 * Usage:
 *   const { submit, isPending, data } = useProductInquiry();
 *   submit({ productName: '…', customerName: '…', customerEmail: '…', message: '…' });
 */

import { useMutation } from '@tanstack/react-query';

import { CaracalApiError, submitProductInquiry } from '@/lib/api';
import type { IntakeConfirmation, ProductInquiryInput } from '@/lib/api';
import { useToast } from '@/lib/toast/use-toast';
import { useApiConfig } from '@/providers/api-provider';

export interface UseProductInquiryReturn {
  submit: (input: ProductInquiryInput) => void;
  submitAsync: (input: ProductInquiryInput) => Promise<IntakeConfirmation>;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  data: IntakeConfirmation | undefined;
  error: Error | null;
  reset: () => void;
}

export function useProductInquiry(): UseProductInquiryReturn {
  const { isDev } = useApiConfig();
  const { success, error: toastError } = useToast();

  const mutation = useMutation<IntakeConfirmation, Error, ProductInquiryInput>({
    mutationFn: submitProductInquiry,

    onSuccess(data) {
      success('Inquiry submitted', `Reference: ${data.referenceCode}`);
    },

    onError(err) {
      const api = err instanceof CaracalApiError ? err : null;
      const suffix = isDev && api?.requestId ? ` [req: ${api.requestId}]` : '';
      toastError(
        'Failed to submit inquiry',
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
