'use client';

import { CATALOG_STATUSES, type AdminCategoryDTO } from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SheetFooter } from '@/components/ui/sheet';
import { FormError } from '@/components/ui/form-error';
import { SingleImageUpload } from '@/components/admin/single-image-upload';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';
import {
  categoryFormSchema,
  type CategoryFormInput,
  type CategoryFormValues,
} from '@/lib/admin/category-brand-form-schemas';

export interface CategoryFormProps {
  category?: AdminCategoryDTO;
  /** Options for the parent select: every top-level category, excluding this one when editing one. */
  topLevelCategories: AdminCategoryDTO[];
  /** Saves the category; a rejection's field errors are shown on the fields. */
  onSubmit: (data: CategoryFormValues) => Promise<void>;
  onCancel: () => void;
}

const STATUS_LABELS: Record<(typeof CATALOG_STATUSES)[number], string> = { active: 'Active', hidden: 'Hidden' };

/** Fields the API can report errors for that this form shows; anything else goes to `FormError`. */
const ERROR_FIELDS = ['name', 'slug', 'parentId', 'description', 'sortOrder', 'status'] as const;

/** Add/edit category dialog form (SPEC §10.7, DESIGN.md §9.6). */
export function CategoryForm({ category, topLevelCategories, onSubmit, onCancel }: CategoryFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormInput, unknown, CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug,
      parentId: category?.parentId ?? null,
      description: category?.description ?? undefined,
      sortOrder: category?.sortOrder ?? 0,
      showOnHome: category?.showOnHome ?? false,
      status: category?.status ?? 'active',
      imageKey: category?.imageKey ?? null,
    },
  });
  const imageKey = useWatch({ control, name: 'imageKey' }) ?? null;
  const uploadId = useWatch({ control, name: 'id' });

  async function submit(values: CategoryFormValues) {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      if (!applyFieldErrors(error, setError, { fields: ERROR_FIELDS })) {
        setFormError(errorMessage(error, "We couldn't save this category. Please try again."));
      }
    }
  }

  const showOnHome = useWatch({ control, name: 'showOnHome' });

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      <FormField label="Name" htmlFor="category-name" error={errors.name?.message} required>
        <Input id="category-name" size="sm" {...register('name')} />
      </FormField>
      <FormField
        label="Slug"
        htmlFor="category-slug"
        error={errors.slug?.message}
        hint={category ? 'Leave blank to keep the current one.' : 'Leave blank to generate from the name.'}
      >
        <Input id="category-slug" size="sm" {...register('slug')} />
      </FormField>
      <FormField label="Parent category" htmlFor="category-parent" error={errors.parentId?.message} hint="Leave blank to make this a top-level category.">
        <Controller
          control={control}
          name="parentId"
          render={({ field }) => (
            <Select
              id="category-parent"
              size="sm"
              placeholder="None (top level)"
              value={field.value ?? ''}
              onValueChange={field.onChange}
              options={topLevelCategories.filter((c) => c.id !== category?.id).map((c) => ({ value: c.id, label: c.name }))}
            />
          )}
        />
      </FormField>
      <FormField label="Description" htmlFor="category-description" error={errors.description?.message} hint="Optional, shown on the category page.">
        <Textarea id="category-description" size="sm" rows={3} {...register('description')} />
      </FormField>
      <SingleImageUpload
        label="Image"
        endpoint="/admin/uploads/category-image"
        ownerField="categoryId"
        ownerId={category?.id ?? uploadId}
        value={imageKey}
        onChange={(key, ownerId) => {
          setValue('imageKey', key, { shouldDirty: true });
          if (!category && ownerId) setValue('id', ownerId);
        }}
        hint="Shown on the category tile. JPG, PNG or WebP."
        disabled={isSubmitting}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Sort order" htmlFor="category-sort-order" error={errors.sortOrder?.message}>
          <Input id="category-sort-order" size="sm" type="number" {...register('sortOrder', { valueAsNumber: true })} />
        </FormField>
        <FormField label="Status" htmlFor="category-status" error={errors.status?.message}>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                id="category-status"
                size="sm"
                value={field.value}
                onValueChange={field.onChange}
                options={CATALOG_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              />
            )}
          />
        </FormField>
      </div>
      <label htmlFor="category-show-on-home" className="flex min-h-9 items-center gap-2.5 text-sm font-medium text-ink">
        <Checkbox
          id="category-show-on-home"
          size="sm"
          checked={showOnHome}
          onCheckedChange={(checked) => setValue('showOnHome', checked === true)}
        />
        Show on home page
      </label>
      <FormError message={formError} />
      <SheetFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {category ? 'Save changes' : 'Add category'}
        </Button>
      </SheetFooter>
    </form>
  );
}
