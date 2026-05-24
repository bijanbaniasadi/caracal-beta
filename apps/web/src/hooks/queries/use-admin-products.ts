'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  createAdminProduct,
  deleteAdminProduct,
  getAdminProduct,
  listAdminProducts,
  updateAdminProduct,
} from '@/lib/api/admin-client';
import type {
  AdminProductDetail,
  AdminProductInput,
  AdminProductListItem,
  ListParams,
  PaginatedList,
} from '@/lib/api/admin-types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const adminProductKeys = {
  all: ['admin', 'products'] as const,
  list: (params?: ListParams) => ['admin', 'products', 'list', params] as const,
  detail: (id: string) => ['admin', 'products', 'detail', id] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useAdminProducts(
  params?: ListParams,
): UseQueryResult<PaginatedList<AdminProductListItem>, Error> {
  return useQuery({
    queryKey: adminProductKeys.list(params),
    queryFn: () => listAdminProducts(params),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminProduct(
  id: string,
): UseQueryResult<AdminProductDetail, Error> {
  return useQuery({
    queryKey: adminProductKeys.detail(id),
    queryFn: () => getAdminProduct(id),
    staleTime: 30_000,
    enabled: !!id,
    retry: false,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminProductInput) => createAdminProduct(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminProductKeys.all });
    },
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AdminProductInput>) =>
      updateAdminProduct(id, input),
    onSuccess: (updated) => {
      qc.setQueryData(adminProductKeys.detail(id), updated);
      void qc.invalidateQueries({ queryKey: adminProductKeys.all });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdminProduct(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminProductKeys.all });
    },
  });
}
