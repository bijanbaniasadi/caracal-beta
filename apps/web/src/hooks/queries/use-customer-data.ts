/**
 * React Query hooks for the customer account portal.
 * Uses the customer-client which has full token refresh support.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAccountSummary,
  getAccountOrders,
  getAccountInquiries,
  getAccountUploads,
  updateAccountProfile,
  changeAccountPassword,
} from '@/lib/api/customer-client';
import type { UpdateProfileInput, ChangePasswordInput } from '@/lib/api/customer-types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const customerKeys = {
  all: ['customer'] as const,
  summary: () => [...customerKeys.all, 'summary'] as const,
  orders: () => [...customerKeys.all, 'orders'] as const,
  inquiries: () => [...customerKeys.all, 'inquiries'] as const,
  uploads: () => [...customerKeys.all, 'uploads'] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAccountSummary(enabled = true) {
  return useQuery({
    queryKey: customerKeys.summary(),
    queryFn: getAccountSummary,
    enabled,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useOrders(enabled = true) {
  return useQuery({
    queryKey: customerKeys.orders(),
    queryFn: getAccountOrders,
    enabled,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useInquiries(enabled = true) {
  return useQuery({
    queryKey: customerKeys.inquiries(),
    queryFn: getAccountInquiries,
    enabled,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useUploads(enabled = true) {
  return useQuery({
    queryKey: customerKeys.uploads(),
    queryFn: getAccountUploads,
    enabled,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateAccountProfile(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: customerKeys.summary() });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => changeAccountPassword(input),
  });
}
