'use client';

import { addressSchema, DEFAULT_CITY, type AddressData, type AddressDTO, type AddressInput, type DeliveryAreaDTO } from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';

export interface AddressFormProps {
  areas: DeliveryAreaDTO[];
  defaultValues?: AddressDTO;
  /** Saves the address; a rejection's field errors are shown on the fields. */
  onSubmit: (data: AddressData) => Promise<void>;
  onCancel: () => void;
}

/**
 * Add/edit address form (SPEC §9, DESIGN.md §8.10) on the shared `addressSchema`, used inside a
 * `Dialog` (`mobile="sheet"`).
 */
export function AddressForm({ areas, defaultValues, onSubmit, onCancel }: AddressFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<AddressInput, unknown, AddressData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: defaultValues?.label ?? '',
      contactName: defaultValues?.contactName ?? '',
      phone: defaultValues?.phone ?? '',
      line1: defaultValues?.line1 ?? '',
      line2: defaultValues?.line2 ?? '',
      landmark: defaultValues?.landmark ?? '',
      areaId: defaultValues?.areaId ?? '',
      city: defaultValues?.city ?? DEFAULT_CITY,
      isDefault: defaultValues?.isDefault ?? false,
    },
  });

  const errors = form.formState.errors;
  const isDefault = useWatch({ control: form.control, name: 'isDefault' });

  async function submit(values: AddressData) {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      if (!applyFieldErrors(error, form.setError)) setFormError(errorMessage(error, "We couldn't save this address. Please try again."));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
      <FormField label="Label" htmlFor="address-label" error={errors.label?.message} required hint="e.g. Home, Site office">
        <Input id="address-label" {...form.register('label')} />
      </FormField>

      <FormField label="Contact name" htmlFor="address-contact-name" error={errors.contactName?.message} required>
        <Input id="address-contact-name" {...form.register('contactName')} />
      </FormField>

      <FormField label="Phone" htmlFor="address-phone" error={errors.phone?.message} required>
        <Input id="address-phone" inputMode="tel" {...form.register('phone')} />
      </FormField>

      <FormField label="Address line" htmlFor="address-line1" error={errors.line1?.message} required>
        <Textarea id="address-line1" rows={2} {...form.register('line1')} />
      </FormField>

      <FormField label="Landmark" htmlFor="address-landmark" error={errors.landmark?.message} hint="Optional">
        <Input id="address-landmark" {...form.register('landmark')} />
      </FormField>

      <FormField label="Delivery area" htmlFor="address-area" error={errors.areaId?.message} required>
        <Controller
          control={form.control}
          name="areaId"
          render={({ field }) => (
            <Select
              id="address-area"
              placeholder="Choose a delivery area"
              value={field.value ?? ''}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={Boolean(errors.areaId)}
              options={areas.map((area) => ({
                value: area.id,
                label: area.isServiceable ? area.name : `${area.name} — not delivering yet`,
                disabled: !area.isServiceable,
              }))}
            />
          )}
        />
      </FormField>

      <label htmlFor="address-is-default" className="flex min-h-11 items-center gap-2.5 text-sm font-medium text-ink">
        <Checkbox
          id="address-is-default"
          size="md"
          checked={isDefault}
          onCheckedChange={(checked) => form.setValue('isDefault', checked === true)}
        />
        Set as default address
      </label>

      <FormError message={formError} />

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={form.formState.isSubmitting}>
          Save address
        </Button>
      </DialogFooter>
    </form>
  );
}
