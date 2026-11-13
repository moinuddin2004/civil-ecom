import type { Metadata } from 'next';
import { parsePageSize } from '@/lib/admin/page-size';
import { AccessDenied } from '@/components/admin/access-denied';
import { UsersView } from '@/components/admin/users-view';
import { can, getAdminCustomers, getPermissionCatalog, getStaffList, isAdmin, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Users' };

interface UsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * `/admin/users` (SPEC §10.8): "Staff & admins" (ADMIN only, SPEC §4.3) and "Customers"
 * (`customers.view`). Only the tab being shown is loaded, and only if the viewer may see it. The
 * customer search/status filter and page are a plain `?q=&status=&page=` query.
 */
export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const me = await requireStaff();
  const canSeeStaff = isAdmin(me);
  const canSeeCustomers = can(me, 'customers.view');
  if (!canSeeStaff && !canSeeCustomers) return <AccessDenied />;

  const sp = await searchParams;
  const requested = firstParam(sp.tab) === 'customers' ? 'customers' : 'staff';
  const tab = requested === 'staff' && !canSeeStaff ? 'customers' : requested === 'customers' && !canSeeCustomers ? 'staff' : requested;
  const q = firstParam(sp.q)?.trim() || undefined;
  const statusParam = firstParam(sp.status);
  const status = statusParam === 'active' || statusParam === 'blocked' ? statusParam : undefined;
  const page = Math.max(1, Number(firstParam(sp.page)) || 1);
  const pageSize = parsePageSize(firstParam(sp.pageSize));

  const [staff, catalog, customers] = await Promise.all([
    tab === 'staff' ? getStaffList() : Promise.resolve([]),
    tab === 'staff' ? getPermissionCatalog() : Promise.resolve(null),
    tab === 'customers' ? getAdminCustomers({ q, status, page, pageSize }) : Promise.resolve(null),
  ]);

  return (
    <UsersView
      tab={tab}
      staff={staff}
      catalog={catalog}
      customers={customers}
      customerQuery={{ q: q ?? '', status: status ?? '' }}
    />
  );
}
