import type { Metadata } from 'next';
import { AuthCard } from '@/components/shop/auth-card';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Log in',
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return (
    <AuthCard title="Log in" subtitle="Welcome back to Aricon Shop.">
      <LoginForm next={next} />
    </AuthCard>
  );
}
