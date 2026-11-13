'use client';

import { formatPkPhone, riderCreateSchema, type RiderCreateInput, type RiderDTO } from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SheetFooter } from '@/components/ui/sheet';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';

/** Parsed form values: the phone is normalised to `+923XXXXXXXXX`. */
export type RiderFormValues = z.output<typeof riderCreateSchema>;

export interface RiderFormProps {
  rider?: RiderDTO;
  /** Saves the rider; a rejection's field errors are shown on the fields. */
  onSubmit: (data: RiderFormValues) => Promise<void>;
  onCancel: () => void;
}

/** Fields the API can report errors for that this form shows; anything else goes to `FormError`. */
const ERROR_FIELDS = ['name', 'phone'] as const;

/** Add/edit rider dialog form (SPEC §10.9). `riderCreateSchema` has no id fields, so it is reused as-is. */
export function RiderForm({ rider, onSubmit, onCancel }: RiderFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RiderCreateInput, unknown, RiderFormValues>({
    resolver: zodResolver(riderCreateSchema),
    defaultValues: { name: rider?.name ?? '', phone: rider ? formatPkPhone(rider.phone) : '', isActive: rider?.isActive ?? true },
  });
  const isActive = useWatch({ control, name: 'isActive' });

  async function submit(values: RiderFormValues) {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      if (!applyFieldErrors(error, setError, { fields: ERROR_FIELDS })) {
        setFormError(errorMessage(error, "We couldn't save this rider. Please try again."));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      <FormField label="Name" htmlFor="rider-name" error={errors.name?.message} required>
        <Input id="rider-name" size="sm" {...register('name')} />
      </FormField>
      <FormField label="Phone" htmlFor="rider-phone" error={errors.phone?.message} required>
        <Input id="rider-phone" size="sm" inputMode="tel" {...register('phone')} />
      </FormField>
      <label htmlFor="rider-active" className="flex min-h-9 items-center gap-2.5 text-sm font-medium text-ink">
        <Checkbox id="rider-active" size="sm" checked={isActive} onCheckedChange={(checked) => setValue('isActive', checked === true)} />
        Active
      </label>
      <FormError message={formError} />
      <SheetFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {rider ? 'Save changes' : 'Add rider'}
        </Button>
      </SheetFooter>
    </form>
  );
}
