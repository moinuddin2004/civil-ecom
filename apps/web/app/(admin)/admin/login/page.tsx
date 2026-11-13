import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminLoginForm } from '@/components/admin/admin-login-form';
import { getAdminMe } from '@/lib/api-server';
import { routes, safeNextPath } from '@/lib/routes';

export const metadata: Metadata = { title: 'Staff login' };

interface AdminLoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

/** Staff login (SPEC §10.1, DESIGN.md §9.1). Already signed in → straight on. */
export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const { next } = await searchParams;
  const target = safeNextPath(Array.isArray(next) ? next[0] : next, routes.admin);
  const adminTarget = target === routes.admin || target.startsWith(`${routes.admin}/`) ? target : routes.admin;

  const me = await getAdminMe();
  if (me) redirect(me.mustChangePassword ? routes.adminChangePassword : adminTarget);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-100 rounded-xl bg-surface p-6 shadow-lifted md:p-8">
        <span className="flex items-baseline gap-1.5 font-display text-ink">
          <span className="text-xl font-bold tracking-wordmark">ARICON</span>
          <span className="text-lg font-medium text-cement">Admin</span>
        </span>
        <h1 className="mt-4 type-h2">Staff login</h1>
        <AdminLoginForm next={adminTarget} />
        <p className="mt-6 border-t border-concrete-150 pt-4 text-center text-sm text-cement">
          Not staff?{' '}
          <Link href={routes.home} className="font-medium text-blueprint underline-offset-2 hover:underline">
            Go to the shop
          </Link>
        </p>
      </div>
    </div>
  );
}
