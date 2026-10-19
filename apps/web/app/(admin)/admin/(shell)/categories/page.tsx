import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { CategoriesView } from '@/components/admin/categories-view';
import { canAny, getAdminCategories, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Categories' };

export default async function AdminCategoriesPage() {
  const me = await requireStaff();
  if (!canAny(me, ['products.view', 'categories.manage'])) return <AccessDenied />;
  return <CategoriesView categories={await getAdminCategories()} />;
}
