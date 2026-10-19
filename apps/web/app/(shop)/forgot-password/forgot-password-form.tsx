'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@aricon/shared';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { iconProps } from '@/components/shop/styles';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/api-errors';
import { routes } from '@/lib/routes';

/**
 * `POST /api/auth/forgot-password` (SPEC §6.11): the API answers the same way whether or not the
 * email is registered, so the page never reveals it either. Only network trouble or the rate limit
 * (3 an hour) show an error.
 */
export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiClient('/auth/forgot-password', { method: 'POST', body: values });
      setSubmitted(true);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-success-50">
          <CheckCircle2 {...iconProps} className="size-6 text-success" />
        </div>
        <p className="text-ink-700">If an account exists for that email, we&apos;ve sent a reset link.</p>
        <Link href={routes.login()} className="link font-semibold">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
      </FormField>

      <FormError message={formError} />

      <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </Button>

      <p className="text-center text-sm text-ink-700">
        <Link href={routes.login()} className="link">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
