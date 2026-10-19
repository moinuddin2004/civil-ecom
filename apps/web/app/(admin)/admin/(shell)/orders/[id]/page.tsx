import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { OrderDetailView } from '@/components/admin/order-detail-view';
import { can, getAdminOrder, getRiders, requireStaff } from '@/lib/admin-data';
import { orNotFound } from '@/lib/api-server';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: OrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await getAdminOrder(id).catch(() => null);
  return { title: order?.orderNumber ?? 'Order' };
}

/**
 * Admin order detail (SPEC §10.4, DESIGN.md §9.3), by order id. Riders are only loaded for staff
 * who can assign one; every action is hidden by its own permission and checked again by the API.
 */
export default async function AdminOrderDetailPage({ params }: OrderDetailPageProps) {
  const me = await requireStaff();
  if (!can(me, 'orders.view')) return <AccessDenied />;

  const { id } = await params;
  const [order, riders] = await Promise.all([
    orNotFound(getAdminOrder(id)),
    can(me, 'orders.assign_rider') ? getRiders() : Promise.resolve([]),
  ]);
  return <OrderDetailView order={order} riders={riders} />;
}
