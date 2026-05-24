'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  createAdminArticle,
  deleteAdminArticle,
  getAdminArticle,
  listAdminArticles,
  updateAdminArticle,
} from '@/lib/api/admin-client';
import type {
  AdminArticleDetail,
  AdminArticleInput,
  AdminArticleListItem,
  ListParams,
  PaginatedList,
} from '@/lib/api/admin-types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const adminArticleKeys = {
  all: ['admin', 'articles'] as const,
  list: (params?: ListParams) => ['admin', 'articles', 'list', params] as const,
  detail: (id: string) => ['admin', 'articles', 'detail', id] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useAdminArticles(
  params?: ListParams,
): UseQueryResult<PaginatedList<AdminArticleListItem>, Error> {
  return useQuery({
    queryKey: adminArticleKeys.list(params),
    queryFn: () => listAdminArticles(params),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminArticle(
  id: string,
): UseQueryResult<AdminArticleDetail, Error> {
  return useQuery({
    queryKey: adminArticleKeys.detail(id),
    queryFn: () => getAdminArticle(id),
    staleTime: 30_000,
    enabled: !!id,
    retry: false,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminArticleInput) => createAdminArticle(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminArticleKeys.all });
    },
  });
}

export function useUpdateArticle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AdminArticleInput>) =>
      updateAdminArticle(id, input),
    onSuccess: (updated) => {
      qc.setQueryData(adminArticleKeys.detail(id), updated);
      void qc.invalidateQueries({ queryKey: adminArticleKeys.all });
    },
  });
}

export function useDeleteArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdminArticle(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminArticleKeys.all });
    },
  });
}
