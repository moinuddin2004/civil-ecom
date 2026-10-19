import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { DeliveryAreasView } from '@/components/admin/delivery-areas-view';
import { can, getAdminDeliveryAreas, requireStaff } from '@/lib/admin-data';
import { getPublicSettings } from '@/lib/api-server';

export const metadata: Metadata = { title: 'Delivery areas' };

/** `/admin/delivery-areas` (SPEC §10.9). The store's default fee comes from the public settings. */
export default async function AdminDeliveryAreasPage() {
  const me = await requireStaff();
  if (!can(me, 'delivery_areas.manage')) return <AccessDenied />;
  const [areas, settings] = await Promise.all([getAdminDeliveryAreas(), getPublicSettings()]);
  return <DeliveryAreasView areas={areas} defaultDeliveryFee={settings.defaultDeliveryFee} />;
}
