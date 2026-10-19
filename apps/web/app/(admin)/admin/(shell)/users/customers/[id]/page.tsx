import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { CustomerDetailView } from '@/components/admin/customer-detail-view';
import { can, getAdminCustomer, requireStaff } from '@/lib/admin-data';
import { orNotFound } from '@/lib/api-server';

export const metadata: Metadata = { title: 'Customer' };

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Customer detail (SPEC §10.8, `customers.view`); an unknown id is a 404. */
export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const me = await requireStaff();
  if (!can(me, 'customers.view')) return <AccessDenied />;

  const { id } = await params;
  const customer = await orNotFound(getAdminCustomer(id));
  return <CustomerDetailView customer={customer} canBlock={can(me, 'customers.block')} canViewOrders={can(me, 'orders.view')} />;
}
