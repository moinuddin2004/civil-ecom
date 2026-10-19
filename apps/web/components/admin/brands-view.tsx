'use client';

import { formatNumber, type AdminBrandDTO, type ApiResponse, type BrandCreateInput, type BrandUpdateInput } from '@aricon/shared';
import { Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/admin/access-denied';
import { BrandForm } from '@/components/admin/brand-form';
import { Pill } from '@/components/shop/status-badges';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { useAdminSession } from '@/lib/admin/session';
import type { BrandFormValues } from '@/lib/admin/category-brand-form-schemas';

export interface BrandsViewProps {
  brands: AdminBrandDTO[];
}

/**
 * Brands admin page (SPEC §10.7, DESIGN.md §9.6): simpler sibling of the categories page, through
 * `/api/admin/brands`. Anyone with `products.view` can see the list; adding and editing need
 * `brands.manage`. After a save the page re-renders with the API's list.
 */
export function BrandsView({ brands }: BrandsViewProps) {
  const { me } = useAdminSession();
  const router = useRouter();
  const [editing, setEditing] = useState<AdminBrandDTO | null | undefined>(undefined);

  if (!me) return null;
  const canManage = me.permissions.includes('brands.manage');
  if (!canManage && !me.permissions.includes('products.view')) return <AccessDenied />;

  /** Errors are left to the form, which puts them on the fields. */
  async function handleSave(values: BrandFormValues) {
    if (editing) {
      const body: BrandUpdateInput = { name: values.name, slug: values.slug, sortOrder: values.sortOrder, status: values.status, logoKey: values.logoKey };
      await apiClient<ApiResponse<AdminBrandDTO>>(`/admin/brands/${editing.id}`, { method: 'PATCH', body });
      toast.success('Brand updated');
    } else {
      const body: BrandCreateInput = {
        ...(values.id && { id: values.id }),
        name: values.name,
        slug: values.slug,
        sortOrder: values.sortOrder,
        status: values.status,
        logoKey: values.logoKey,
      };
      await apiClient<ApiResponse<AdminBrandDTO>>('/admin/brands', { method: 'POST', body });
      toast.success('Brand created');
    }
    setEditing(undefined);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h1">Brands</h1>
        {canManage ? (
          <Button size="sm" onClick={() => setEditing(null)}>
            <Plus aria-hidden strokeWidth={1.75} className="size-4" />
            Add brand
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-concrete-150 bg-surface shadow-card">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-concrete-150 text-left text-xs text-cement">
              <th className="py-2.5 pr-3 pl-4 font-medium">Name</th>
              <th className="py-2.5 pr-3 font-medium">Slug</th>
              <th className="py-2.5 pr-3 font-medium">Products</th>
              <th className="py-2.5 pr-3 font-medium">Sort order</th>
              <th className="py-2.5 pr-3 font-medium">Status</th>
              {canManage ? <th className="py-2.5 pr-4 font-medium" /> : null}
            </tr>
          </thead>
          <tbody>
            {[...brands].sort((a, b) => a.sortOrder - b.sortOrder).map((brand) => (
              <tr key={brand.id} className="border-b border-concrete-150 last:border-b-0 hover:bg-concrete-50">
                <td className="py-2.5 pr-3 pl-4 font-medium text-ink">{brand.name}</td>
                <td className="py-2.5 pr-3 font-mono text-xs text-ink-700">{brand.slug}</td>
                <td className="py-2.5 pr-3 tabular-nums text-ink-700">{formatNumber(brand.productCount)}</td>
                <td className="py-2.5 pr-3 tabular-nums text-ink-700">{brand.sortOrder}</td>
                <td className="py-2.5 pr-3">
                  <Pill tone={brand.status === 'active' ? 'success' : 'neutral'} size="sm">
                    {brand.status === 'active' ? 'Active' : 'Hidden'}
                  </Pill>
                </td>
                {canManage ? (
                  <td className="py-2.5 pr-4">
                    <Button type="button" variant="tertiary" size="sm" onClick={() => setEditing(brand)}>
                      <Pencil aria-hidden strokeWidth={1.75} className="size-3.5" />
                      Edit
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
          <DialogContent size="md" mobile="sheet" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add brand'}</DialogTitle>
            </DialogHeader>
            {editing !== undefined ? (
              <BrandForm key={editing?.id ?? 'new'} brand={editing ?? undefined} onSubmit={handleSave} onCancel={() => setEditing(undefined)} />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
