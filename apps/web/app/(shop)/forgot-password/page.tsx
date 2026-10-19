import type { Metadata } from 'next';
import { AuthCard } from '@/components/shop/auth-card';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot your password',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
