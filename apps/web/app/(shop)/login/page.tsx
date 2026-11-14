import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/shop/auth-card';
import { routes } from '@/lib/routes';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Log in',
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, error } = await searchParams;

  return (
    <AuthCard title="Log in" subtitle="Welcome back to Aricon Shop.">
      <LoginForm next={next} initialError={error} />
      <p className="mt-5 border-t border-concrete-150 pt-4 text-center text-sm text-cement">
        Aricon staff?{' '}
        <Link href={routes.adminLogin()} rel="nofollow" className="font-medium text-blueprint underline-offset-2 hover:underline">
          Staff login
        </Link>
      </p>
    </AuthCard>
  );
}
