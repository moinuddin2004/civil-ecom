import type { AdminMeDTO } from '@aricon/shared';
import type { ReactNode } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';

/**
 * The admin shell: sidebar + top bar + content. The `(shell)` layout has already checked the
 * session (`requireStaff()`), so `me` is always a signed-in staff member here.
 */
export function AdminShell({ me, children }: { me: AdminMeDTO; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <AdminSidebar me={me} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar me={me} />
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
