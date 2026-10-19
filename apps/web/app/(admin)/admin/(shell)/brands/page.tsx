import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { BrandsView } from '@/components/admin/brands-view';
import { canAny, getAdminBrands, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Brands' };

export default async function AdminBrandsPage() {
  const me = await requireStaff();
  if (!canAny(me, ['products.view', 'brands.manage'])) return <AccessDenied />;
  return <BrandsView brands={await getAdminBrands()} />;
}
