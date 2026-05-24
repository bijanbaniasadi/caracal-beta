'use client';

import { useState } from 'react';
import type { IntakeStatus } from '@/lib/api/types';
import type { IntakeRow } from '@/lib/api/admin-types';
import { useAdminIntake } from '@/hooks/queries/use-admin-intake';
import { InquiriesTable } from '@/components/admin/inquiries/inquiries-table';

export default function AdminInquiriesPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<IntakeStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<IntakeRow['type'] | ''>('');
  const pageSize = 25;

  const { data, isLoading } = useAdminIntake({
    page,
    pageSize,
    status: statusFilter || undefined,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between pb-1">
        <p className="text-sm text-brand-muted">
          {isLoading ? '…' : `${data?.total ?? 0} total inquiries`}
        </p>
      </div>

      <InquiriesTable
        items={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? pageSize}
        totalPages={data?.totalPages ?? 0}
        onPage={setPage}
        statusFilter={statusFilter}
        onStatusFilter={(s) => { setStatusFilter(s); setPage(1); }}
        typeFilter={typeFilter}
        onTypeFilter={(t) => { setTypeFilter(t); setPage(1); }}
      />
    </div>
  );
}
