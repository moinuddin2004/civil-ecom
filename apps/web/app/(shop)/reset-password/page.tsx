import { resetTokenSchema } from '@aricon/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/shop/auth-card';
import { routes } from '@/lib/routes';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;
  const parsed = token ? resetTokenSchema.safeParse(token) : null;

  if (!parsed?.success) {
    return (
      <AuthCard title="Reset your password">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-ink-700">This reset link is not valid or has expired.</p>
          <Link href={routes.forgotPassword} className="link font-semibold">
            Request a new reset link
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" subtitle="Choose a new password for your account.">
      <ResetPasswordForm token={parsed.data} />
    </AuthCard>
  );
}
