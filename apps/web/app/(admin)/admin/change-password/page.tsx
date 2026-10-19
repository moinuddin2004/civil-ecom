import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminChangePasswordForm } from '@/components/admin/admin-change-password-form';
import { getAdminMe } from '@/lib/api-server';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Change password' };

/**
 * Change password (SPEC §10.1, §6.11): forced after an admin sets a temporary password, and
 * reachable from the top bar any time. While the change is forced there is nowhere else to go.
 */
export default async function AdminChangePasswordPage() {
  const me = await getAdminMe();
  if (!me) redirect(routes.adminLogin(routes.adminChangePassword));
  const forced = me.mustChangePassword;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-100 rounded-xl bg-surface p-6 shadow-lifted md:p-8">
        <h1 className="type-h2">{forced ? 'Set a new password to continue' : 'Change password'}</h1>
        <p className="mt-1.5 text-sm text-ink-700">
          Signed in as {me.user.name}.{' '}
          {forced ? 'Choose a new password before continuing to the admin panel.' : 'Your other devices will be signed out.'}
        </p>
        <AdminChangePasswordForm forced={forced} />
        {forced ? null : (
          <Link href={routes.admin} className="link mt-4 inline-block text-sm font-medium">
            Back to admin
          </Link>
        )}
      </div>
    </div>
  );
}
