'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  cancelAdminOrder,
  getAdminOrder,
  listAdminOrders,
  refundAdminOrder,
  updateAdminOrder,
} from '@/lib/api/admin-client';
import type {
  AdminOrder,
  ListParams,
  OrderRefundInput,
  OrderUpdateInput,
  PaginatedList,
} from '@/lib/api/admin-types';

export const adminOrderKeys = {
  all: ['admin', 'orders'] as const,
  list: (params?: ListParams) => ['admin', 'orders', 'list', params] as const,
  detail: (id: string) => ['admin', 'orders', 'detail', id] as const,
};

export function useAdminOrders(
  params?: ListParams,
): UseQueryResult<PaginatedList<AdminOrder>, Error> {
  return useQuery({
    queryKey: adminOrderKeys.list(params),
    queryFn: () => listAdminOrders(params),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminOrder(id: string): UseQueryResult<AdminOrder, Error> {
  return useQuery({
    queryKey: adminOrderKeys.detail(id),
    queryFn: () => getAdminOrder(id),
    staleTime: 30_000,
    enabled: !!id,
    retry: false,
  });
}

export function useUpdateOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OrderUpdateInput) => updateAdminOrder(id, input),
    onSuccess: (updated) => {
      qc.setQueryData(adminOrderKeys.detail(id), updated);
      void qc.invalidateQueries({ queryKey: adminOrderKeys.all });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelAdminOrder(id),
    onSuccess: (updated) => {
      qc.setQueryData(adminOrderKeys.detail(updated.id), updated);
      void qc.invalidateQueries({ queryKey: adminOrderKeys.all });
    },
  });
}

export function useRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OrderRefundInput }) =>
      refundAdminOrder(id, input),
    onSuccess: ({ order }) => {
      qc.setQueryData(adminOrderKeys.detail(order.id), order);
      void qc.invalidateQueries({ queryKey: adminOrderKeys.all });
    },
  });
}
