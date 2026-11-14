'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, type SignupInput } from '@aricon/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { GoogleSignInButton } from '@/components/shop/google-sign-in-button';
import { PasswordInput } from '@/components/shop/password-input';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';
import { routes, safeNextPath } from '@/lib/routes';

/**
 * `POST /api/auth/signup` (SPEC §6.11): always creates a CUSTOMER but starts no session. The
 * customer is sent to the verification page; only the emailed link (or Google) signs them in.
 * Email/phone already in use land on their field.
 */
export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', companyName: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiClient('/auth/signup', { method: 'POST', body: values });
      router.push(routes.verifyEmail(values.email, safeNextPath(next, routes.account)));
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(errorMessage(error));
    }
  });

  return (
    <div className="flex flex-col gap-4">
      <GoogleSignInButton next={next} />
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-cement" aria-hidden>
        <span className="h-px flex-1 bg-concrete-150" />
        or
        <span className="h-px flex-1 bg-concrete-150" />
      </div>

      <form noValidate onSubmit={onSubmit} className="grid gap-x-4 gap-y-3 md:grid-cols-2">
        <FormField label="Full name" htmlFor="name" error={errors.name?.message} required>
          <Input id="name" autoComplete="name" aria-invalid={Boolean(errors.name)} {...register('name')} />
        </FormField>
        <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </FormField>
        <FormField label="Phone" htmlFor="phone" error={errors.phone?.message} required hint="Like 0300 1234567">
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            {...register('phone')}
          />
        </FormField>
        <FormField
          label="Password"
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
        <FormField label="Company name" htmlFor="companyName" error={errors.companyName?.message} hint="Optional" className="md:col-span-2">
          <Input id="companyName" autoComplete="organization" {...register('companyName')} />
        </FormField>

        <FormError message={formError} className="md:col-span-2" />

        <Button type="submit" size="lg" className="mt-1 w-full md:col-span-2" loading={isSubmitting}>
          {isSubmitting ? 'Creating your account…' : 'Sign up'}
        </Button>

        <p className="text-center text-sm text-ink-700 md:col-span-2">
          Already have an account?{' '}
          <Link href={routes.login(next)} className="link font-semibold">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
