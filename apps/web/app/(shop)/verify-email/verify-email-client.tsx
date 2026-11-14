'use client';

import { CheckCircle2, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ResendVerificationForm } from '@/components/shop/resend-verification';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/api-errors';
import { routes } from '@/lib/routes';

type State = 'idle' | 'verifying' | 'verified' | 'error';

/**
 * Takes `?token=` from the verification email and posts it once. The link is single use: a second
 * visit is explained, not retried. Verification never starts a session — the customer logs in next.
 */
export function VerifyEmailClient({ token, email, next }: { token?: string; email?: string; next: string }) {
  const [state, setState] = useState<State>(token ? 'verifying' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    apiClient('/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => setState('verified'))
      .catch((caught: unknown) => {
        setError(errorMessage(caught));
        setState('error');
      });
  }, [token]);

  if (state === 'verifying') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <MailCheck aria-hidden className="size-8 text-blueprint" />
        <p className="text-sm text-ink-700" role="status">
          Checking your verification link…
        </p>
      </div>
    );
  }

  if (state === 'verified') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <CheckCircle2 aria-hidden className="size-9 text-success" />
          <p className="text-sm text-ink-700" role="status">
            Your email is verified. You can log in now.
          </p>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href={routes.login(next)}>Log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {state === 'error' ? (
        <>
          <FormError message={error} />
          <p className="text-sm text-ink-700">
            The link you followed is not valid or has expired. Ask for a new one below.
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <MailCheck aria-hidden className="size-9 text-blueprint" />
          <p className="text-sm text-ink-700" role="status">
            We sent a verification link{email ? <> to <strong className="text-ink">{email}</strong></> : null}. Open it
            to finish signing up. The link works for 60 minutes.
          </p>
        </div>
      )}

      <div className="border-t border-concrete-150 pt-4">
        <p className="mb-3 text-sm font-medium text-ink">Need another link?</p>
        <ResendVerificationForm defaultEmail={email ?? ''} />
      </div>

      <p className="text-center text-sm text-ink-700">
        Already verified?{' '}
        <Link href={routes.login(next)} className="link font-semibold">
          Log in
        </Link>
      </p>
    </div>
  );
}
