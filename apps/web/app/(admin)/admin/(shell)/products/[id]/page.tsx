import type { Metadata } from 'next';
import { BackButton } from '@/components/ui/back-button';
import { AccessDenied } from '@/components/admin/access-denied';
import { ProductForm } from '@/components/admin/product-form';
import { can, getAdminBrands, getAdminCategories, getAdminProduct, requireStaff } from '@/lib/admin-data';
import { orNotFound } from '@/lib/api-server';

interface ProductEditPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductEditPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getAdminProduct(id).catch(() => null);
  return { title: product?.name ?? 'Product' };
}

export default async function AdminEditProductPage({ params }: ProductEditPageProps) {
  const me = await requireStaff();
  if (!can(me, 'products.view')) return <AccessDenied />;

  const { id } = await params;
  const [product, categories, brands] = await Promise.all([
    orNotFound(getAdminProduct(id)),
    getAdminCategories(),
    getAdminBrands(),
  ]);
  return (
    <>
      <BackButton fallbackHref="/admin/products" className="mb-2" />
      <ProductForm mode="edit" product={product} categories={categories} brands={brands} />
    </>
  );
}
