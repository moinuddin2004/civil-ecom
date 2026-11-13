import type { Metadata } from 'next';
import { BackButton } from '@/components/ui/back-button';
import { AccessDenied } from '@/components/admin/access-denied';
import { ProductForm } from '@/components/admin/product-form';
import { can, getAdminBrands, getAdminCategories, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Add product' };

export default async function AdminNewProductPage() {
  const me = await requireStaff();
  if (!can(me, 'products.create')) return <AccessDenied />;
  const [categories, brands] = await Promise.all([getAdminCategories(), getAdminBrands()]);
  return (
    <>
      <BackButton fallbackHref="/admin/products" className="mb-2" />
      <ProductForm mode="create" categories={categories} brands={brands} />
    </>
  );
}
