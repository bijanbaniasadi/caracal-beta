'use client';

/**
 * useWorkshopConsultation — typed mutation hook for POST /api/workshop-consultations.
 *
 * On success: fires a success toast with the reference code.
 * On error:   fires an error toast; in dev mode the backend request-id is
 *             surfaced for log correlation.
 *
 * Usage:
 *   const { submit, isPending, data } = useWorkshopConsultation();
 *   submit({ workshopName: '…', contactName: '…', contactEmail: '…', message: '…' });
 */

import { useMutation } from '@tanstack/react-query';

import { CaracalApiError, submitWorkshopConsultation } from '@/lib/api';
import type { IntakeConfirmation, WorkshopConsultationInput } from '@/lib/api';
import { useToast } from '@/lib/toast/use-toast';
import { useApiConfig } from '@/providers/api-provider';

export interface UseWorkshopConsultationReturn {
  submit: (input: WorkshopConsultationInput) => void;
  submitAsync: (input: WorkshopConsultationInput) => Promise<IntakeConfirmation>;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  data: IntakeConfirmation | undefined;
  error: Error | null;
  reset: () => void;
}

export function useWorkshopConsultation(): UseWorkshopConsultationReturn {
  const { isDev } = useApiConfig();
  const { success, error: toastError } = useToast();

  const mutation = useMutation<IntakeConfirmation, Error, WorkshopConsultationInput>({
    mutationFn: submitWorkshopConsultation,

    onSuccess(data) {
      success('Consultation request submitted', `Reference: ${data.referenceCode}`);
    },

    onError(err) {
      const api = err instanceof CaracalApiError ? err : null;
      const suffix = isDev && api?.requestId ? ` [req: ${api.requestId}]` : '';
      toastError(
        'Failed to submit consultation request',
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
