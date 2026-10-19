import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { RidersView } from '@/components/admin/riders-view';
import { canAny, getRiders, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Riders' };

export default async function AdminRidersPage() {
  const me = await requireStaff();
  if (!canAny(me, ['riders.manage', 'orders.assign_rider'])) return <AccessDenied />;
  return <RidersView riders={await getRiders()} />;
}
