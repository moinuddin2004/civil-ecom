'use client';

import { changePasswordSchema, type ChangePasswordInput } from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';
import { routes } from '@/lib/routes';

/**
 * `POST /api/admin/auth/change-password`: clears a forced change and signs out every other login,
 * keeping this one. Then into the admin panel with a fresh render (the session no longer says
 * "must change password").
 */
export function AdminChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(values: ChangePasswordInput) {
    setFormError(null);
    try {
      await apiClient('/admin/auth/change-password', { method: 'POST', body: values });
      toast.success('Password changed');
      router.replace(routes.admin);
      router.refresh();
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(errorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
      <FormField
        label={forced ? 'Current (temporary) password' : 'Current password'}
        htmlFor="currentPassword"
        error={errors.currentPassword?.message}
      >
        <Input id="currentPassword" type="password" autoComplete="current-password" {...register('currentPassword')} />
      </FormField>
      <FormField
        label="New password"
        htmlFor="newPassword"
        error={errors.newPassword?.message}
        hint="8–72 characters, at least one letter and one number."
      >
        <Input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} />
      </FormField>
      <FormError message={formError} />
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Change password
      </Button>
    </form>
  );
}
