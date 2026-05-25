/**
 * React Query hooks for customer account data.
 * All hooks return graceful empty states when not authenticated or API unavailable.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCustomerProfile,
  getCustomerOrders,
  getCustomerOrder,
  getCustomerInquiries,
  getCustomerUploads,
  updateCustomerProfile,
} from '@/lib/api/account-client';
import type { CustomerProfileUpdateInput } from '@/lib/api/account-types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const accountKeys = {
  all: ['account'] as const,
  profile: () => [...accountKeys.all, 'profile'] as const,
  orders: () => [...accountKeys.all, 'orders'] as const,
  order: (id: string) => [...accountKeys.all, 'orders', id] as const,
  inquiries: () => [...accountKeys.all, 'inquiries'] as const,
  uploads: () => [...accountKeys.all, 'uploads'] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCustomerProfile(enabled = true) {
  return useQuery({
    queryKey: accountKeys.profile(),
    queryFn: getCustomerProfile,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCustomerOrders(enabled = true) {
  return useQuery({
    queryKey: accountKeys.orders(),
    queryFn: getCustomerOrders,
    enabled,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useCustomerOrder(id: string, enabled = true) {
  return useQuery({
    queryKey: accountKeys.order(id),
    queryFn: () => getCustomerOrder(id),
    enabled: enabled && !!id,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useCustomerInquiries(enabled = true) {
  return useQuery({
    queryKey: accountKeys.inquiries(),
    queryFn: getCustomerInquiries,
    enabled,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useCustomerUploads(enabled = true) {
  return useQuery({
    queryKey: accountKeys.uploads(),
    queryFn: getCustomerUploads,
    enabled,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerProfileUpdateInput) => updateCustomerProfile(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: accountKeys.profile() });
    },
  });
}
