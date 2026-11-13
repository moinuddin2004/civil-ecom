'use client';

import { CATALOG_STATUSES, type AdminBrandDTO } from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { SheetFooter } from '@/components/ui/sheet';
import { FormError } from '@/components/ui/form-error';
import { SingleImageUpload } from '@/components/admin/single-image-upload';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';
import { brandFormSchema, type BrandFormInput, type BrandFormValues } from '@/lib/admin/category-brand-form-schemas';

export interface BrandFormProps {
  brand?: AdminBrandDTO;
  /** Saves the brand; a rejection's field errors are shown on the fields. */
  onSubmit: (data: BrandFormValues) => Promise<void>;
  onCancel: () => void;
}

const STATUS_LABELS: Record<(typeof CATALOG_STATUSES)[number], string> = { active: 'Active', hidden: 'Hidden' };

/** Fields the API can report errors for that this form shows; anything else goes to `FormError`. */
const ERROR_FIELDS = ['name', 'slug', 'sortOrder', 'status'] as const;

/** Add/edit brand dialog form (SPEC §10.7, DESIGN.md §9.6). */
export function BrandForm({ brand, onSubmit, onCancel }: BrandFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BrandFormInput, unknown, BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      name: brand?.name ?? '',
      slug: brand?.slug,
      sortOrder: brand?.sortOrder ?? 0,
      status: brand?.status ?? 'active',
      logoKey: brand?.logoKey ?? null,
    },
  });
  const logoKey = useWatch({ control, name: 'logoKey' }) ?? null;
  const uploadId = useWatch({ control, name: 'id' });

  async function submit(values: BrandFormValues) {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      if (!applyFieldErrors(error, setError, { fields: ERROR_FIELDS })) {
        setFormError(errorMessage(error, "We couldn't save this brand. Please try again."));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      <FormField label="Name" htmlFor="brand-name" error={errors.name?.message} required>
        <Input id="brand-name" size="sm" {...register('name')} />
      </FormField>
      <FormField
        label="Slug"
        htmlFor="brand-slug"
        error={errors.slug?.message}
        hint={brand ? 'Leave blank to keep the current one.' : 'Leave blank to generate from the name.'}
      >
        <Input id="brand-slug" size="sm" {...register('slug')} />
      </FormField>
      <SingleImageUpload
        label="Logo"
        endpoint="/admin/uploads/brand-logo"
        ownerField="brandId"
        ownerId={brand?.id ?? uploadId}
        value={logoKey}
        onChange={(key, ownerId) => {
          setValue('logoKey', key, { shouldDirty: true });
          if (!brand && ownerId) setValue('id', ownerId);
        }}
        hint="JPG, PNG or WebP, ideally on a white or clear background."
        disabled={isSubmitting}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Sort order" htmlFor="brand-sort-order" error={errors.sortOrder?.message}>
          <Input id="brand-sort-order" size="sm" type="number" {...register('sortOrder', { valueAsNumber: true })} />
        </FormField>
        <FormField label="Status" htmlFor="brand-status" error={errors.status?.message}>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                id="brand-status"
                size="sm"
                value={field.value}
                onValueChange={field.onChange}
                options={CATALOG_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              />
            )}
          />
        </FormField>
      </div>
      <FormError message={formError} />
      <SheetFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {brand ? 'Save changes' : 'Add brand'}
        </Button>
      </SheetFooter>
    </form>
  );
}
