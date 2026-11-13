'use client';

import {
  formatDate,
  formatPKR,
  type AdminCustomerDetailDTO,
  type AdminCustomerListItemDTO,
  type ApiListResponse,
  type ApiResponse,
} from '@aricon/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Pill } from '@/components/shop/status-badges';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/ui/download-button';
import { AutoFilterForm } from '@/components/admin/auto-filter-form';
import { LiveSearchInput } from '@/components/admin/live-search-input';
import { Select } from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { buildAdminHref } from '@/lib/admin/query-string';
import { errorMessage } from '@/lib/api-errors';
import { AdminPagination } from './admin-pagination';
import { ConfirmDialog } from './confirm-dialog';

export interface CustomersTabProps {
  customers: ApiListResponse<AdminCustomerListItemDTO>;
  query: { q: string; status: string };
  canExport: boolean;
  canBlock: boolean;
}

/**
 * Customers tab (SPEC §10.8): search + status filter are a plain `method="get"` form (same
 * zero-JS idiom as the storefront filter panel — see `lib/admin/query-string.ts`), so the
 * filtered, paginated list is server-rendered by `app/(admin)/admin/(shell)/users/page.tsx`.
 * Block/Unblock (`customers.block`) asks for confirmation, then re-renders the page's data.
 */
export function CustomersTab({ customers, query, canExport, canBlock }: CustomersTabProps) {
  const router = useRouter();
  const [blockTarget, setBlockTarget] = useState<AdminCustomerListItemDTO | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function setBlocked(customer: AdminCustomerListItemDTO) {
    if (pendingId) return;
    const blocking = customer.status === 'active';
    setPendingId(customer.id);
    try {
      await apiClient<ApiResponse<AdminCustomerDetailDTO>>(`/admin/customers/${customer.id}/${blocking ? 'block' : 'unblock'}`, {
        method: 'POST',
        body: {},
      });
      toast.success(blocking ? `${customer.name} blocked` : `${customer.name} unblocked`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <AutoFilterForm className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value="customers" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customers-q" className="text-sm font-medium text-ink">
              Search
            </label>
            <LiveSearchInput id="customers-q" size="sm" defaultValue={query.q ?? ''} placeholder="Name, email or phone" className="w-56" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customers-status" className="text-sm font-medium text-ink">
              Status
            </label>
            <Select
              id="customers-status"
              name="status"
              size="sm"
              defaultValue={query.status}
              placeholder="Any status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'blocked', label: 'Blocked' },
              ]}
            />
          </div>
        </AutoFilterForm>
        {canExport ? (
          <DownloadButton
            path={buildAdminHref('/admin/customers/export', { q: query.q || undefined, status: query.status || undefined })}
            fileName="customers.xlsx"
            variant="secondary"
            size="sm"
          >
            Export to Excel
          </DownloadButton>
        ) : (
          <Button type="button" variant="secondary" size="sm" disabled title="You don't have permission to export customers.">
            Export to Excel
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-concrete-150 bg-surface shadow-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-concrete-150 bg-concrete-50 text-left text-xs text-cement">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Phone</th>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">Orders</th>
              <th className="px-4 py-2.5 font-medium">Total spent</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Joined</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.data.map((customer) => (
              <tr key={customer.id} className="border-b border-concrete-150 last:border-b-0 hover:bg-concrete-50">
                <td className="px-4 py-2.5 font-medium text-ink">
                  <Link href={`/admin/users/customers/${customer.id}`} className="hover:text-blueprint">
                    {customer.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-ink-700">{customer.email}</td>
                <td className="px-4 py-2.5 text-ink-700">{customer.phone || '—'}</td>
                <td className="px-4 py-2.5 text-ink-700">{customer.companyName ?? '—'}</td>
                <td className="px-4 py-2.5 tabular-nums text-ink-700">{customer.orderCount}</td>
                <td className="px-4 py-2.5 tabular-nums text-ink-700">{formatPKR(customer.totalSpent)}</td>
                <td className="px-4 py-2.5">
                  <Pill tone={customer.status === 'active' ? 'success' : 'danger'} size="sm">
                    {customer.status === 'active' ? 'Active' : 'Blocked'}
                  </Pill>
                </td>
                <td className="px-4 py-2.5 text-ink-700">{formatDate(customer.createdAt)}</td>
                <td className="px-4 py-2.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!canBlock || (pendingId !== null && pendingId !== customer.id)}
                    loading={pendingId === customer.id}
                    title={canBlock ? undefined : "You don't have permission to block customers."}
                    onClick={() => setBlockTarget(customer)}
                  >
                    {customer.status === 'active' ? 'Block' : 'Unblock'}
                  </Button>
                </td>
              </tr>
            ))}
            {customers.data.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-cement">
                  No customers match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminPagination
        basePath="/admin/users"
        query={{ tab: 'customers', q: query.q, status: query.status }}
        meta={customers.meta}
      />

      <ConfirmDialog
        open={blockTarget !== null}
        onOpenChange={(open) => !open && setBlockTarget(null)}
        title={`${blockTarget?.status === 'active' ? 'Block' : 'Unblock'} ${blockTarget?.name ?? ''}?`}
        description={
          blockTarget?.status === 'active'
            ? "They won't be able to sign in or place orders until unblocked."
            : 'They will be able to sign in and place orders again.'
        }
        confirmLabel={blockTarget?.status === 'active' ? 'Block' : 'Unblock'}
        confirmVariant={blockTarget?.status === 'active' ? 'destructive' : 'primary'}
        onConfirm={() => {
          if (blockTarget) void setBlocked(blockTarget);
        }}
      />
    </div>
  );
}
