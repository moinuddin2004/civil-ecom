'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordInput } from '@aricon/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { PasswordInput } from '@/components/shop/password-input';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';
import { routes } from '@/lib/routes';

/**
 * `POST /api/auth/reset-password` (SPEC §6.11). `token` comes from the emailed link (checked for
 * shape by the page) and travels as a hidden value. Success signs the person out everywhere and
 * sends them to log in with the new password; an expired or used link shows the API's message.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiClient('/auth/reset-password', { method: 'POST', body: values });
      toast.success('Your password was changed. Log in with the new one.');
      router.push(routes.login());
    } catch (error) {
      if (!applyFieldErrors(error, setError, { fields: ['password'] })) setFormError(errorMessage(error));
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField
        label="New password"
        htmlFor="password"
        error={errors.password?.message}
        required
        hint="8–72 characters, with at least one letter and one number."
      >
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
      </FormField>

      <FormError message={formError} />

      <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Reset password'}
      </Button>
    </form>
  );
}
