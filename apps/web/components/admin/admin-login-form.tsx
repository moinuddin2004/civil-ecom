'use client';

import { adminLoginSchema, type AdminLoginInput, type AdminMeDTO, type ApiResponse } from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ResendVerificationButton } from '@/components/shop/resend-verification';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage, isApiError } from '@/lib/api-errors';
import { routes } from '@/lib/routes';

/**
 * `POST /api/admin/auth/login` (sets the admin cookies), then on to `next` — or to the forced
 * password change first (SPEC §6.11). Wrong email/password, a locked or blocked account all come
 * back as one message from the API, shown above the button. Staff never sign in with Google; an
 * unverified account gets its message plus a resend action.
 */
export function AdminLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginInput>({ resolver: zodResolver(adminLoginSchema) });

  async function onSubmit(values: AdminLoginInput) {
    setFormError(null);
    setVerificationEmail(null);
    try {
      const { data: me } = await apiClient<ApiResponse<AdminMeDTO>>('/admin/auth/login', { method: 'POST', body: values });
      router.replace(me.mustChangePassword ? routes.adminChangePassword : next);
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.code === 'EMAIL_NOT_VERIFIED') {
        const details = error.details as { email?: unknown } | undefined;
        setVerificationEmail(typeof details?.email === 'string' ? details.email : values.email);
        setFormError(error.message);
        return;
      }
      if (!applyFieldErrors(error, setError)) setFormError(errorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
      <FormField label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="username" {...register('email')} />
      </FormField>
      <FormField label="Password" htmlFor="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
      </FormField>
      <FormError message={formError} />
      {verificationEmail ? <ResendVerificationButton email={verificationEmail} /> : null}
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
