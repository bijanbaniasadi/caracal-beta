'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { listInventory, updateInventory } from '@/lib/api/admin-client';
import type {
  AdminInventoryItem,
  AdminInventoryUpdate,
  ListParams,
  PaginatedList,
} from '@/lib/api/admin-types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const adminInventoryKeys = {
  all: ['admin', 'inventory'] as const,
  list: (params?: ListParams) =>
    ['admin', 'inventory', 'list', params] as const,
};

// ─── Query ────────────────────────────────────────────────────────────────────

export function useAdminInventory(
  params?: ListParams,
): UseQueryResult<PaginatedList<AdminInventoryItem>, Error> {
  return useQuery({
    queryKey: adminInventoryKeys.list(params),
    queryFn: () => listInventory(params),
    staleTime: 15_000,
    retry: false,
  });
}

// ─── Mutation ─────────────────────────────────────────────────────────────────

export function useUpdateInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      update,
    }: {
      id: string;
      update: AdminInventoryUpdate;
    }) => updateInventory(id, update),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminInventoryKeys.all });
    },
  });
}
