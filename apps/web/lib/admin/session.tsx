'use client';

import type { AdminMeDTO } from '@aricon/shared';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { apiClient } from '../api-client';
import { routes } from '../routes';

/**
 * The signed-in staff member as the server saw it for this page (`GET /api/admin/auth/me`, read
 * by the admin root layout), or null on the login page. Rendered from the server, so
 * `router.refresh()` after login, logout or a password change updates it everywhere.
 *
 * Permissions here only decide what the UI shows; the API checks every request itself.
 */

interface AdminSessionValue {
  me: AdminMeDTO | null;
  /** Ends this browser's admin session and goes to the login page. False if the API was unreachable. */
  signOut: () => Promise<boolean>;
}

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function AdminSessionProvider({ me, children }: { me: AdminMeDTO | null; children: ReactNode }) {
  const router = useRouter();

  const signOut = useCallback(async () => {
    try {
      await apiClient('/admin/auth/logout', { method: 'POST' });
    } catch {
      return false;
    }
    router.replace(routes.adminLogin());
    router.refresh();
    return true;
  }, [router]);

  const value = useMemo<AdminSessionValue>(() => ({ me, signOut }), [me, signOut]);
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionValue {
  const context = useContext(AdminSessionContext);
  if (!context) throw new Error('useAdminSession() must be used within <AdminSessionProvider>.');
  return context;
}
