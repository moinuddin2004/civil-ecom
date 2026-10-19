import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getAdminMe } from '@/lib/api-server';
import { AdminSessionProvider } from '@/lib/admin/session';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Aricon Admin' },
  robots: { index: false, follow: false },
};

/**
 * Every `/admin/*` route gets the staff session (null when signed out); the sidebar/topbar shell
 * and its sign-in guard come from the nested `(shell)` layout, so `/admin/login` and
 * `/admin/change-password` render on their own.
 */
export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const me = await getAdminMe();
  return <AdminSessionProvider me={me}>{children}</AdminSessionProvider>;
}
