import { parsePageSize } from '@/lib/admin/page-size';
import { PRODUCT_STATUSES, type ProductStatus } from '@aricon/shared';
import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { ProductsListView, type ProductsListFilters } from '@/components/admin/products-list-view';
import { can, getAdminBrands, getAdminCategories, getAdminProducts, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Products' };

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isProductStatus(value: string | undefined): value is ProductStatus {
  return value !== undefined && (PRODUCT_STATUSES as readonly string[]).includes(value);
}

/**
 * Admin products list (SPEC §10.5). The URL keeps readable category/brand slugs; the API filters
 * by id, so they are looked up in the lists the filter bar needs anyway. Without a status filter
 * the API lists active and hidden products (archived ones only when asked for).
 */
export default async function AdminProductsPage({ searchParams }: ProductsPageProps) {
  const me = await requireStaff();
  if (!can(me, 'products.view')) return <AccessDenied />;

  const sp = await searchParams;
  const q = first(sp.q)?.trim() || undefined;
  const categorySlug = first(sp.category) || '';
  const brandSlug = first(sp.brand) || '';
  const statusRaw = first(sp.status);
  const status = isProductStatus(statusRaw) ? statusRaw : undefined;
  const lowStock = first(sp.lowStock) === '1';
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const pageSize = parsePageSize(first(sp.pageSize));

  const [categories, brands] = await Promise.all([getAdminCategories(), getAdminBrands()]);
  const categoryId = categories.find((category) => category.slug === categorySlug)?.id;
  const brandId = brands.find((brand) => brand.slug === brandSlug)?.id;
  const { data: products, meta } = await getAdminProducts({ q, categoryId, brandId, status, lowStock, page, pageSize });

  const filters: ProductsListFilters = {
    q: q ?? '',
    categorySlug: categoryId ? categorySlug : '',
    brandSlug: brandId ? brandSlug : '',
    status: status ?? '',
    lowStock,
  };

  return <ProductsListView products={products} meta={meta} categories={categories} brands={brands} filters={filters} />;
}
