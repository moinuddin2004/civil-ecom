import type { Metadata } from 'next';
import { AuthCard } from '@/components/shop/auth-card';
import { SignupForm } from './signup-form';

export const metadata: Metadata = {
  title: 'Sign up',
  robots: { index: false, follow: false },
};

interface SignupPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams;

  return (
    <AuthCard wide title="Create your account" subtitle="Order construction materials, bulk-priced, delivered in Karachi.">
      <SignupForm next={next} />
    </AuthCard>
  );
}
