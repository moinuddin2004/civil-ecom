'use client';

import type { AdminCustomerListItemDTO, ApiListResponse, PermissionCatalogDTO, StaffDTO } from '@aricon/shared';
import Link from 'next/link';
import { useAdminSession } from '@/lib/admin/session';
import { CustomersTab } from './customers-tab';
import { StaffTab } from './staff-tab';

export interface UsersViewProps {
  /** The tab to show; the page has already checked the viewer may see it. */
  tab: 'staff' | 'customers';
  /** Loaded only when `tab === 'staff'`. */
  staff: StaffDTO[];
  /** Loaded only when `tab === 'staff'`. */
  catalog: PermissionCatalogDTO | null;
  /** Loaded only when `tab === 'customers'`. */
  customers: ApiListResponse<AdminCustomerListItemDTO> | null;
  customerQuery: { q: string; status: string };
}

/**
 * `/admin/users` shell (SPEC §10.8): "Staff & admins" is ADMIN only (no permission bypasses it,
 * SPEC §4.3), "Customers" needs `customers.view`. The tab links only show when the viewer may see
 * both; switching tabs is a plain `<Link>`, and the page loads just the tab being shown.
 */
export function UsersView({ tab, staff, catalog, customers, customerQuery }: UsersViewProps) {
  const { me } = useAdminSession();
  if (!me) return null;

  const canSeeStaff = me.user.role === 'ADMIN';
  const canSeeCustomers = me.permissions.includes('customers.view');

  return (
    <div className="flex flex-col gap-5">
      <h1 className="type-h1">Users</h1>

      {canSeeStaff && canSeeCustomers ? (
        <div className="flex gap-1 border-b border-concrete-150">
          <Link
            href="/admin/users?tab=staff"
            aria-current={tab === 'staff' || undefined}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium ${
              tab === 'staff' ? 'border-ink text-ink' : 'border-transparent text-cement hover:text-ink'
            }`}
          >
            Staff &amp; admins
          </Link>
          <Link
            href="/admin/users?tab=customers"
            aria-current={tab === 'customers' || undefined}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium ${
              tab === 'customers' ? 'border-ink text-ink' : 'border-transparent text-cement hover:text-ink'
            }`}
          >
            Customers
          </Link>
        </div>
      ) : null}

      {tab === 'staff' && catalog ? <StaffTab staff={staff} catalog={catalog} me={me} /> : null}
      {tab === 'customers' && customers ? (
        <CustomersTab
          customers={customers}
          query={customerQuery}
          canExport={me.permissions.includes('customers.export')}
          canBlock={me.permissions.includes('customers.block')}
        />
      ) : null}
    </div>
  );
}
