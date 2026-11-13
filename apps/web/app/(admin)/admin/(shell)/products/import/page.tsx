import type { Metadata } from 'next';
import { BackButton } from '@/components/ui/back-button';
import { AccessDenied } from '@/components/admin/access-denied';
import { ProductImportView } from '@/components/admin/product-import-view';
import { can, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Import products' };

export default async function AdminProductImportPage() {
  const me = await requireStaff();
  if (!can(me, 'products.import')) return <AccessDenied />;
  return (
    <>
      <BackButton fallbackHref="/admin/products" className="mb-2" />
      <ProductImportView />
    </>
  );
}
