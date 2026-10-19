'use client';

import {
  changePasswordSchema,
  profileSchema,
  type ChangePasswordInput,
  type CustomerDTO,
  type ProfileInput,
} from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { CARD_CLASS } from '@/components/shop/styles';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';

export interface ProfileFormsProps {
  customer: CustomerDTO;
}

/**
 * Profile (SPEC §9): name/phone/company (`PATCH /api/account/profile`), read-only email, and a
 * separate change-password form (`POST /api/account/change-password`, which signs out every other
 * device but keeps this one signed in).
 */
export function ProfileForms({ customer }: ProfileFormsProps) {
  const router = useRouter();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: customer.name,
      phone: customer.phone,
      companyName: customer.companyName ?? '',
    },
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  async function submitProfile(values: ProfileInput) {
    setProfileError(null);
    try {
      await apiClient('/account/profile', { method: 'PATCH', body: values });
      toast.success('Profile updated');
      router.refresh();
    } catch (error) {
      if (!applyFieldErrors(error, profileForm.setError)) setProfileError(errorMessage(error));
    }
  }

  async function submitPassword(values: ChangePasswordInput) {
    setPasswordError(null);
    try {
      await apiClient('/account/change-password', { method: 'POST', body: values });
      toast.success('Password changed. Other devices have been signed out.');
      passwordForm.reset();
    } catch (error) {
      if (!applyFieldErrors(error, passwordForm.setError)) setPasswordError(errorMessage(error));
    }
  }

  const profileErrors = profileForm.formState.errors;
  const passwordErrors = passwordForm.formState.errors;

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={profileForm.handleSubmit(submitProfile)}
        className={cn(CARD_CLASS, 'flex flex-col gap-4 p-5')}
      >
        <h2 className="type-h3">Your details</h2>

        <FormField label="Email" htmlFor="profile-email" hint="Contact us to change your email." disabled>
          <Input id="profile-email" value={customer.email} disabled readOnly />
        </FormField>

        <FormField label="Name" htmlFor="profile-name" error={profileErrors.name?.message} required>
          <Input id="profile-name" {...profileForm.register('name')} />
        </FormField>

        <FormField label="Phone" htmlFor="profile-phone" error={profileErrors.phone?.message} required>
          <Input id="profile-phone" inputMode="tel" {...profileForm.register('phone')} />
        </FormField>

        <FormField
          label="Company name"
          htmlFor="profile-company"
          error={profileErrors.companyName?.message}
          hint="Optional"
        >
          <Input id="profile-company" {...profileForm.register('companyName')} />
        </FormField>

        <FormError message={profileError} />

        <Button type="submit" className="self-start" loading={profileForm.formState.isSubmitting}>
          Save changes
        </Button>
      </form>

      <form
        onSubmit={passwordForm.handleSubmit(submitPassword)}
        className={cn(CARD_CLASS, 'flex flex-col gap-4 p-5')}
      >
        <h2 className="type-h3">Change password</h2>

        <FormField
          label="Current password"
          htmlFor="password-current"
          error={passwordErrors.currentPassword?.message}
          required
        >
          <Input
            id="password-current"
            type="password"
            autoComplete="current-password"
            {...passwordForm.register('currentPassword')}
          />
        </FormField>

        <FormField
          label="New password"
          htmlFor="password-new"
          error={passwordErrors.newPassword?.message}
          required
          hint="At least 8 characters, with a letter and a number."
        >
          <Input
            id="password-new"
            type="password"
            autoComplete="new-password"
            {...passwordForm.register('newPassword')}
          />
        </FormField>

        <FormError message={passwordError} />

        <Button type="submit" variant="secondary" className="self-start" loading={passwordForm.formState.isSubmitting}>
          Change password
        </Button>
      </form>
    </div>
  );
}
