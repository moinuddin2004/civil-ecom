'use client';

import {
  formatDate,
  formatNumber,
  formatPKR,
  PRODUCT_STATUS_LABELS,
  type AdminBrandDTO,
  type AdminCategoryDTO,
  type AdminProductListItemDTO,
  type PageMeta,
  type Permission,
  type ProductStatus,
} from '@aricon/shared';
import { PackageSearch } from 'lucide-react';
import Link from 'next/link';
import { AccessDenied } from '@/components/admin/access-denied';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { Pill } from '@/components/shop/status-badges';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/ui/download-button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { categoryOptions } from '@/lib/admin/category-options';
import { buildAdminHref } from '@/lib/admin/query-string';
import { useAdminSession } from '@/lib/admin/session';

export interface ProductsListFilters {
  q: string;
  categorySlug: string;
  brandSlug: string;
  status: ProductStatus | '';
  lowStock: boolean;
}

export interface ProductsListViewProps {
  products: AdminProductListItemDTO[];
  meta: PageMeta;
  categories: AdminCategoryDTO[];
  brands: AdminBrandDTO[];
  filters: ProductsListFilters;
}

/**
 * Admin products list (SPEC §10.5, DESIGN.md §9.4). Filters are a plain `method="get"` form (same
 * pattern as the storefront `FilterPanel`) so the whole list is server-rendered from
 * `getAdminProducts()`; this client component only gates the page behind `products.view` and shows
 * per-row/action affordances by permission.
 */
export function ProductsListView({ products, meta, categories, brands, filters }: ProductsListViewProps) {
  const { me } = useAdminSession();
  if (!me) return null;
  const can = (perm: Permission) => me.permissions.includes(perm);
  if (!can('products.view')) return <AccessDenied />;

  const categoryChoices = categoryOptions(categories, 'slug');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h1">Products</h1>
        <div className="flex flex-wrap items-center gap-2">
          {can('products.export') ? (
            <DownloadButton
              path={buildAdminHref('/admin/products/export', {
                q: filters.q || undefined,
                categoryId: categories.find((category) => category.slug === filters.categorySlug)?.id,
                brandId: brands.find((brand) => brand.slug === filters.brandSlug)?.id,
                status: filters.status || undefined,
                lowStock: filters.lowStock ? 'true' : undefined,
              })}
              fileName="products.xlsx"
              variant="secondary"
              size="sm"
            >
              Export to Excel
            </DownloadButton>
          ) : null}
          {can('products.import') ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/products/import">Import from Excel</Link>
            </Button>
          ) : null}
          {can('products.create') ? (
            <Button asChild size="sm">
              <Link href="/admin/products/new">Add product</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-concrete-150 bg-surface p-4 shadow-card">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="products-q" className="text-sm font-medium text-ink">
            Search
          </label>
          <Input id="products-q" name="q" size="sm" placeholder="Name or SKU" defaultValue={filters.q} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="products-category" className="text-sm font-medium text-ink">
            Category
          </label>
          <Select id="products-category" name="category" size="sm" placeholder="All categories" defaultValue={filters.categorySlug} options={categoryChoices} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="products-brand" className="text-sm font-medium text-ink">
            Brand
          </label>
          <Select
            id="products-brand"
            name="brand"
            size="sm"
            placeholder="All brands"
            defaultValue={filters.brandSlug}
            options={brands.map((brand) => ({ value: brand.slug, label: brand.name }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="products-status" className="text-sm font-medium text-ink">
            Status
          </label>
          <Select
            id="products-status"
            name="status"
            size="sm"
            placeholder="Active and hidden"
            defaultValue={filters.status}
            options={Object.entries(PRODUCT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <label htmlFor="products-low-stock" className="flex h-9 items-center gap-2 text-sm font-medium text-ink">
          <Checkbox id="products-low-stock" name="lowStock" value="1" defaultChecked={filters.lowStock} size="sm" />
          Low stock only
        </label>
        <Button type="submit" variant="secondary" size="sm">
          Apply
        </Button>
        {(filters.q || filters.categorySlug || filters.brandSlug || filters.status || filters.lowStock) ? (
          <Button asChild type="button" variant="tertiary" size="sm">
            <Link href="/admin/products">Clear</Link>
          </Button>
        ) : null}
      </form>

      <div className="overflow-x-auto rounded-xl border border-concrete-150 bg-surface shadow-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-concrete-150 text-left text-xs text-cement">
              <th className="py-2.5 pr-3 pl-4 font-medium">Product</th>
              <th className="py-2.5 pr-3 font-medium">Brand</th>
              <th className="py-2.5 pr-3 font-medium">Category</th>
              <th className="py-2.5 pr-3 font-medium">Price range</th>
              <th className="py-2.5 pr-3 font-medium">Stock</th>
              <th className="py-2.5 pr-3 font-medium">Status</th>
              <th className="py-2.5 pr-4 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-concrete-150 last:border-b-0 hover:bg-concrete-50">
                <td className="py-2.5 pr-3 pl-4">
                  <Link href={`/admin/products/${product.id}`} className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-concrete-150 bg-concrete-50 text-concrete-400">
                      <PackageSearch aria-hidden strokeWidth={1.75} className="size-5" />
                    </span>
                    <span className="font-medium text-ink hover:text-blueprint">{product.name}</span>
                  </Link>
                </td>
                <td className="py-2.5 pr-3 text-ink-700">{product.brandName}</td>
                <td className="py-2.5 pr-3 text-ink-700">{product.categoryName}</td>
                <td className="py-2.5 pr-3 tabular-nums text-ink">
                  {product.minPrice === product.maxPrice ? formatPKR(product.minPrice) : `${formatPKR(product.minPrice)} – ${formatPKR(product.maxPrice)}`}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-ink">{formatNumber(product.totalStock)}</span>
                    {product.totalStock === 0 ? (
                      <Pill tone="danger" size="sm">Out of stock</Pill>
                    ) : product.hasLowStock ? (
                      <Pill tone="warning" size="sm">Low stock</Pill>
                    ) : null}
                  </div>
                </td>
                <td className="py-2.5 pr-3">
                  <Pill tone={product.status === 'active' ? 'success' : product.status === 'hidden' ? 'neutral' : 'muted'} size="sm">
                    {PRODUCT_STATUS_LABELS[product.status]}
                  </Pill>
                </td>
                <td className="py-2.5 pr-4 text-ink-700">{formatDate(product.updatedAt)}</td>
              </tr>
            ))}
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-cement">
                  No products match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-ink-700">{formatNumber(meta.total)} products</p>
      <AdminPagination
        basePath="/admin/products"
        query={{ q: filters.q || undefined, category: filters.categorySlug || undefined, brand: filters.brandSlug || undefined, status: filters.status || undefined, lowStock: filters.lowStock ? '1' : undefined }}
        meta={meta}
      />
    </div>
  );
}
