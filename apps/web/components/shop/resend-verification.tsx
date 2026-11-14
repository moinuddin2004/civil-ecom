'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/api-errors';

const SENT = "If that address needs verifying, we've sent a new link. It works for 60 minutes.";

function useResend(initialEmail: string) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function resend(current = email) {
    setState('sending');
    setError(null);
    try {
      await apiClient('/auth/resend-verification', { method: 'POST', body: { email: current } });
      setState('sent');
    } catch (caught) {
      setState('idle');
      setError(errorMessage(caught));
    }
  }

  return { email, setEmail, state, error, resend };
}

/**
 * One-click resend for an address we already know (the login error carries it), and a small form
 * when the visitor has to type it. The answer never says whether an account exists.
 */
export function ResendVerificationButton({ email, className }: { email: string; className?: string }) {
  const { state, error, resend } = useResend(email);
  return (
    <div className={className}>
      <Button
        type="button"
        variant="secondary"
        size="md"
        className="w-full"
        loading={state === 'sending'}
        disabled={state === 'sent'}
        onClick={() => void resend(email)}
      >
        {state === 'sent' ? 'New link sent' : state === 'sending' ? 'Sending…' : 'Resend verification email'}
      </Button>
      {state === 'sent' ? <p className="mt-2 text-center text-sm text-ink-700">{SENT}</p> : null}
      <FormError message={error} className="mt-2" />
    </div>
  );
}

export function ResendVerificationForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const { email, setEmail, state, error, resend } = useResend(defaultEmail);

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void resend(email);
      }}
    >
      <FormField label="Email address" htmlFor="resend-email">
        <Input
          id="resend-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </FormField>
      {state === 'sent' ? <p className="text-sm text-ink-700">{SENT}</p> : null}
      <FormError message={error} />
      <Button type="submit" variant="secondary" size="md" loading={state === 'sending'} disabled={!email || state === 'sent'}>
        {state === 'sent' ? 'New link sent' : 'Send a new link'}
      </Button>
    </form>
  );
}
