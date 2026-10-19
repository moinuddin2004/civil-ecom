'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { apiClient } from '../api-client';
import { cartQueryKeys } from '../cart/keys';
import { routes } from '../routes';

/**
 * Signs the customer out of this browser (`POST /api/auth/logout`, which always succeeds and clears
 * the cookies), drops the cached server cart, and goes home with a fresh server render so the
 * header and session context see a guest. A network failure still leaves the session cookie, so
 * it is reported instead of pretending the sign-out worked.
 */
export function useCustomerLogout(): { logout: () => Promise<boolean>; loggingOut: boolean } {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await apiClient('/auth/logout', { method: 'POST' });
      queryClient.removeQueries({ queryKey: cartQueryKeys.all });
      router.replace(routes.home);
      router.refresh();
      return true;
    } catch {
      return false;
    } finally {
      setLoggingOut(false);
    }
  }, [queryClient, router]);

  return { logout, loggingOut };
}
