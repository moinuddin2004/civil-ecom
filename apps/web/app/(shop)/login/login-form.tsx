'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@aricon/shared';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { PasswordInput } from '@/components/shop/password-input';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';
import { routes, safeNextPath } from '@/lib/routes';
import { useSignInRedirect } from '@/lib/session/use-sign-in-redirect';

/**
 * `POST /api/auth/login` (SPEC §6.11): email or mobile number in any format. The API sets the
 * session cookies; then the guest cart is merged and the visitor goes to `next` (or their account).
 * Wrong details, a locked or a blocked account come back as one message above the button.
 */
export function LoginForm({ next }: { next?: string }) {
  const signedIn = useSignInRedirect();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiClient('/auth/login', { method: 'POST', body: values });
      await signedIn(safeNextPath(next, routes.account));
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(errorMessage(error));
    }
  });

  const forgotPasswordHref = next ? `${routes.forgotPassword}?next=${encodeURIComponent(next)}` : routes.forgotPassword;

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField label="Email or phone" htmlFor="identifier" error={errors.identifier?.message} required>
        <Input
          id="identifier"
          autoComplete="username"
          aria-invalid={Boolean(errors.identifier)}
          {...register('identifier')}
        />
      </FormField>
      <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
      </FormField>

      <FormError message={formError} />

      <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Log in'}
      </Button>

      <div className="flex flex-col items-center gap-2 text-sm">
        <p className="text-ink-700">
          Don&apos;t have an account?{' '}
          <Link href={routes.signup(next)} className="link font-semibold">
            Sign up
          </Link>
        </p>
        <Link href={forgotPasswordHref} className="link">
          Forgot your password?
        </Link>
      </div>
    </form>
  );
}
