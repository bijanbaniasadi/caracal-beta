'use client';

import { useState } from 'react';
import type { BinUploadStatus } from '@/lib/api/types';
import { useAdminUploads } from '@/hooks/queries/use-admin-uploads';
import { UploadsBrowser } from '@/components/admin/uploads/uploads-browser';

export default function AdminUploadsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<BinUploadStatus | ''>('');
  const pageSize = 25;

  const { data, isLoading } = useAdminUploads({
    page,
    pageSize,
    status: statusFilter || undefined,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-muted">
          {isLoading ? '…' : `${data?.total ?? 0} total uploads`}
        </p>
      </div>

      <UploadsBrowser
        items={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? pageSize}
        totalPages={data?.totalPages ?? 0}
        onPage={setPage}
        statusFilter={statusFilter}
        onStatusFilter={(s) => { setStatusFilter(s); setPage(1); }}
      />
    </div>
  );
}
