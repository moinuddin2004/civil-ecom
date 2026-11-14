'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@aricon/shared';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { GoogleSignInButton } from '@/components/shop/google-sign-in-button';
import { PasswordInput } from '@/components/shop/password-input';
import { ResendVerificationButton } from '@/components/shop/resend-verification';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage, isApiError } from '@/lib/api-errors';
import { routes, safeNextPath } from '@/lib/routes';
import { useSignInRedirect } from '@/lib/session/use-sign-in-redirect';

/** Google failure codes the API redirects with (`?error=...`); shown above the form. */
const GOOGLE_ERRORS: Record<string, string> = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_failed: "Google sign-in didn't finish. Please try again.",
  google_unverified: "Google hasn't verified that email address. Verify it with Google, then try again.",
  google_staff: 'Staff accounts sign in with their email and password, not Google.',
  google_blocked: 'This account has been blocked. Contact us if you think this is a mistake.',
  google_account_mismatch:
    'This email is already linked to a different Google account. Sign in with that Google account, or use your password.',
  google_unavailable: 'Google sign-in is not set up right now. Use email and password instead.',
};

/**
 * `POST /api/auth/login` (SPEC §6.11): email or mobile number in any format. The API sets the
 * session cookies; then the guest cart is merged and the visitor goes to `next` (or their account).
 * Wrong details, a locked or a blocked account come back as one message above the button. An
 * unverified account gets its message plus a resend action, and Google is offered to customers only.
 */
export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const signedIn = useSignInRedirect();
  const [formError, setFormError] = useState<string | null>(
    initialError ? (GOOGLE_ERRORS[initialError] ?? 'Google sign-in failed. Please try again.') : null,
  );
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
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
    setVerificationEmail(null);
    try {
      await apiClient('/auth/login', { method: 'POST', body: values });
      await signedIn(safeNextPath(next, routes.account));
    } catch (error) {
      if (isApiError(error) && error.code === 'EMAIL_NOT_VERIFIED') {
        const details = error.details as { email?: unknown } | undefined;
        setVerificationEmail(typeof details?.email === 'string' ? details.email : null);
        setFormError(error.message);
        return;
      }
      if (!applyFieldErrors(error, setError)) setFormError(errorMessage(error));
    }
  });

  const forgotPasswordHref = next ? `${routes.forgotPassword}?next=${encodeURIComponent(next)}` : routes.forgotPassword;

  return (
    <div className="flex flex-col gap-4">
      <GoogleSignInButton next={next} />
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-cement" aria-hidden>
        <span className="h-px flex-1 bg-concrete-150" />
        or
        <span className="h-px flex-1 bg-concrete-150" />
      </div>

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
        <div className="-mt-2 flex justify-end">
          <Link href={forgotPasswordHref} className="link text-sm">
            Forgot your password?
          </Link>
        </div>

        <FormError message={formError} />
        {verificationEmail ? (
          <ResendVerificationButton email={verificationEmail} />
        ) : null}

        <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Log in'}
        </Button>

        <p className="text-center text-sm text-ink-700">
          Don&apos;t have an account?{' '}
          <Link href={routes.signup(next)} className="link font-semibold">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
