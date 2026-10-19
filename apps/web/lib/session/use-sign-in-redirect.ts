'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { mergeGuestCart } from '../cart/cart-context';

/**
 * After a customer logs in or signs up: merge the guest cart (SPEC §6.3), go to `target`, and
 * refresh the server render so the header, cart and account pages see the new session.
 */
export function useSignInRedirect(): (target: string) => Promise<void> {
  const router = useRouter();
  return useCallback(
    async (target: string) => {
      await mergeGuestCart();
      router.replace(target);
      router.refresh();
    },
    [router],
  );
}
