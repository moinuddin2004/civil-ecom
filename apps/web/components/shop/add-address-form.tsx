'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { addressSchema, DEFAULT_CITY, type AddressDTO, type AddressInput, type ApiResponse, type DeliveryAreaDTO } from '@aricon/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { CARD_CLASS } from './styles';

export interface AddAddressFormProps {
  areas: DeliveryAreaDTO[];
  /** Called with the customer's whole address list after the new one was saved (it is last). */
  onAdd: (addresses: AddressDTO[]) => void;
  /** Omitted when this is the only (first) address form, so there's nothing to cancel back to. */
  onCancel?: () => void;
}

const DEFAULT_VALUES: AddressInput = {
  label: '',
  contactName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  areaId: '',
  city: DEFAULT_CITY,
};

/**
 * Inline "Add new address" at checkout (SPEC §8.7): saved to the customer's account
 * (`POST /api/account/addresses`, max 10) so it is there next time too.
 */
export function AddAddressForm({ areas, onAdd, onCancel }: AddAddressFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { data } = await apiClient<ApiResponse<AddressDTO[]>>('/account/addresses', { method: 'POST', body: values });
      onAdd(data);
      reset(DEFAULT_VALUES);
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(errorMessage(error, "We couldn't save this address. Please try again."));
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className={cn(CARD_CLASS, 'flex flex-col gap-4 p-4')}>
      <h3 className="type-h3">Add new address</h3>

      <FormField label="Label" htmlFor="new-label" error={errors.label?.message} required hint="Like Home or Site – Gulshan">
        <Input id="new-label" aria-invalid={Boolean(errors.label)} {...register('label')} />
      </FormField>
      <FormField label="Contact name" htmlFor="new-contact-name" error={errors.contactName?.message} required>
        <Input id="new-contact-name" autoComplete="name" aria-invalid={Boolean(errors.contactName)} {...register('contactName')} />
      </FormField>
      <FormField label="Phone" htmlFor="new-phone" error={errors.phone?.message} required hint="Like 0300 1234567">
        <Input id="new-phone" type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} {...register('phone')} />
      </FormField>
      <FormField label="Address line" htmlFor="new-line1" error={errors.line1?.message} required>
        <Input id="new-line1" autoComplete="address-line1" aria-invalid={Boolean(errors.line1)} {...register('line1')} />
      </FormField>
      <FormField label="Address line 2" htmlFor="new-line2" error={errors.line2?.message} hint="Optional">
        <Input id="new-line2" autoComplete="address-line2" {...register('line2')} />
      </FormField>
      <FormField label="Landmark" htmlFor="new-landmark" error={errors.landmark?.message} hint="Optional">
        <Input id="new-landmark" {...register('landmark')} />
      </FormField>
      <FormField label="Delivery area" htmlFor="new-area" error={errors.areaId?.message} required>
        <Select
          id="new-area"
          placeholder="Choose an area"
          aria-invalid={Boolean(errors.areaId)}
          {...register('areaId')}
          options={areas.map((area) => ({
            value: area.id,
            label: area.isServiceable ? area.name : `${area.name} (not delivering yet)`,
            disabled: !area.isServiceable,
          }))}
        />
      </FormField>
      <FormField label="City" htmlFor="new-city" error={errors.city?.message} required>
        <Input id="new-city" autoComplete="address-level2" aria-invalid={Boolean(errors.city)} {...register('city')} />
      </FormField>

      <FormError message={formError} />

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="md" loading={isSubmitting}>
          Save address
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
