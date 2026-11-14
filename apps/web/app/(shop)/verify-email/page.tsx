import type { Metadata } from 'next';
import { AuthCard } from '@/components/shop/auth-card';
import { routes, safeNextPath } from '@/lib/routes';
import { VerifyEmailClient } from './verify-email-client';

export const metadata: Metadata = {
  title: 'Verify your email',
  robots: { index: false, follow: false },
};

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string | string[]; email?: string | string[]; next?: string | string[] }>;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Landing page for the verification email and the "check your inbox" step after sign-up. */
export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams;
  const token = one(params.token);
  const email = one(params.email);
  const next = safeNextPath(one(params.next), routes.account);

  return (
    <AuthCard
      title={token ? 'Verify your email' : 'Check your inbox'}
      subtitle={token ? 'One click and your account is ready.' : 'We sent you a link to confirm your address.'}
    >
      <VerifyEmailClient token={token} email={email} next={next} />
    </AuthCard>
  );
}
