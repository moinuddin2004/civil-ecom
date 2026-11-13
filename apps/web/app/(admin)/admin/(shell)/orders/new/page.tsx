import type { Metadata } from 'next';
import { BackButton } from '@/components/ui/back-button';
import { AccessDenied } from '@/components/admin/access-denied';
import { CreateOrderForm } from '@/components/admin/create-order-form';
import { can, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Create order' };

/** Staff create an order for a customer (SPEC §6.6a). Needs `orders.create`; the API checks it again. */
export default async function AdminCreateOrderPage() {
  const me = await requireStaff();
  if (!can(me, 'orders.create')) return <AccessDenied />;
  return (
    <>
      <BackButton fallbackHref="/admin/orders" className="mb-2" />
      <CreateOrderForm />
    </>
  );
}
