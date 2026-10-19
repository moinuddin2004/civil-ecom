'use client';

import {
  formatNumber,
  type AdminCategoryDTO,
  type ApiResponse,
  type CategoryCreateInput,
  type CategoryUpdateInput,
} from '@aricon/shared';
import { Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/admin/access-denied';
import { CategoryForm } from '@/components/admin/category-form';
import { Pill } from '@/components/shop/status-badges';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { useAdminSession } from '@/lib/admin/session';
import type { CategoryFormValues } from '@/lib/admin/category-brand-form-schemas';

export interface CategoriesViewProps {
  categories: AdminCategoryDTO[];
}

/** Rows ordered top-level, then its children indented right after it (SPEC §10.7). */
function orderedRows(categories: AdminCategoryDTO[]): (AdminCategoryDTO & { depth: 0 | 1 })[] {
  const topLevel = categories.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const rows: (AdminCategoryDTO & { depth: 0 | 1 })[] = [];
  for (const parent of topLevel) {
    rows.push({ ...parent, depth: 0 });
    const children = categories.filter((c) => c.parentId === parent.id).sort((a, b) => a.sortOrder - b.sortOrder);
    for (const child of children) rows.push({ ...child, depth: 1 });
  }
  return rows;
}

/**
 * Categories admin page (SPEC §10.7, DESIGN.md §9.6): grouped table + add/edit dialog through
 * `/api/admin/categories`. Anyone with `products.view` can see the list; adding and editing need
 * `categories.manage`. After a save the page re-renders with the API's list.
 */
export function CategoriesView({ categories }: CategoriesViewProps) {
  const { me } = useAdminSession();
  const router = useRouter();
  const [editing, setEditing] = useState<AdminCategoryDTO | null | undefined>(undefined);

  if (!me) return null;
  const canManage = me.permissions.includes('categories.manage');
  if (!canManage && !me.permissions.includes('products.view')) return <AccessDenied />;

  const topLevelCategories = categories.filter((c) => !c.parentId);

  /** Errors are left to the form, which puts them on the fields. */
  async function handleSave(values: CategoryFormValues) {
    // Home page tiles are top-level categories only (the table shows "—" for sub-categories).
    const showOnHome = values.parentId ? false : values.showOnHome;
    if (editing) {
      const body: CategoryUpdateInput = {
        name: values.name,
        slug: values.slug,
        parentId: values.parentId,
        description: values.description ?? null,
        sortOrder: values.sortOrder,
        showOnHome,
        status: values.status,
        imageKey: values.imageKey,
      };
      await apiClient<ApiResponse<AdminCategoryDTO>>(`/admin/categories/${editing.id}`, { method: 'PATCH', body });
      toast.success('Category updated');
    } else {
      const body: CategoryCreateInput = {
        ...(values.id && { id: values.id }),
        imageKey: values.imageKey,
        name: values.name,
        slug: values.slug,
        parentId: values.parentId,
        description: values.description,
        sortOrder: values.sortOrder,
        showOnHome,
        status: values.status,
      };
      await apiClient<ApiResponse<AdminCategoryDTO>>('/admin/categories', { method: 'POST', body });
      toast.success('Category created');
    }
    setEditing(undefined);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h1">Categories</h1>
        {canManage ? (
          <Button size="sm" onClick={() => setEditing(null)}>
            <Plus aria-hidden strokeWidth={1.75} className="size-4" />
            Add category
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-concrete-150 bg-surface shadow-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-concrete-150 text-left text-xs text-cement">
              <th className="py-2.5 pr-3 pl-4 font-medium">Name</th>
              <th className="py-2.5 pr-3 font-medium">Slug</th>
              <th className="py-2.5 pr-3 font-medium">Products</th>
              <th className="py-2.5 pr-3 font-medium">Sort order</th>
              <th className="py-2.5 pr-3 font-medium">Show on home</th>
              <th className="py-2.5 pr-3 font-medium">Status</th>
              {canManage ? <th className="py-2.5 pr-4 font-medium" /> : null}
            </tr>
          </thead>
          <tbody>
            {orderedRows(categories).map((category) => (
              <tr key={category.id} className="border-b border-concrete-150 last:border-b-0 hover:bg-concrete-50">
                <td className="py-2.5 pr-3 pl-4 font-medium text-ink" style={{ paddingLeft: category.depth === 1 ? '2rem' : undefined }}>
                  {category.name}
                </td>
                <td className="py-2.5 pr-3 font-mono text-xs text-ink-700">{category.slug}</td>
                <td className="py-2.5 pr-3 tabular-nums text-ink-700">{formatNumber(category.productCount)}</td>
                <td className="py-2.5 pr-3 tabular-nums text-ink-700">{category.sortOrder}</td>
                <td className="py-2.5 pr-3 text-ink-700">{category.depth === 0 ? (category.showOnHome ? 'Yes' : 'No') : '—'}</td>
                <td className="py-2.5 pr-3">
                  <Pill tone={category.status === 'active' ? 'success' : 'neutral'} size="sm">
                    {category.status === 'active' ? 'Active' : 'Hidden'}
                  </Pill>
                </td>
                {canManage ? (
                  <td className="py-2.5 pr-4">
                    <Button type="button" variant="tertiary" size="sm" onClick={() => setEditing(category)}>
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
          <DialogContent size="lg" mobile="sheet" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add category'}</DialogTitle>
            </DialogHeader>
            {editing !== undefined ? (
              <CategoryForm
                key={editing?.id ?? 'new'}
                category={editing ?? undefined}
                topLevelCategories={topLevelCategories}
                onSubmit={handleSave}
                onCancel={() => setEditing(undefined)}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
