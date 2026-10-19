import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireStaff } from '@/lib/admin-data';

/**
 * Every admin route except `/admin/login` and `/admin/change-password` (a Next.js route group —
 * `(shell)` does not appear in the URL). Signed out → login; a forced password change pending →
 * change password (the API refuses everything else until then anyway, SPEC §6.11).
 */
export default async function AdminShellLayout({ children }: { children: ReactNode }) {
  const me = await requireStaff();
  return <AdminShell me={me}>{children}</AdminShell>;
}
