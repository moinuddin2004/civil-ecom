'use client';

import type { CustomerDTO } from '@aricon/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CartProvider } from '@/lib/cart/cart-context';
import { getQueryClient } from '@/lib/query-client';
import { CustomerSessionProvider } from '@/lib/session/customer-session';

/**
 * Client-side context for the whole app: TanStack Query, the signed-in customer (from the server
 * render, refreshed by `router.refresh()`) and the cart that depends on it.
 */
export function Providers({ customer, children }: Readonly<{ customer: CustomerDTO | null; children: ReactNode }>) {
  // Not useState: React may throw away state from a render that suspends before the first
  // commit, which would create a second client (TanStack Query's App Router guidance).
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerSessionProvider customer={customer}>
        <CartProvider>{children}</CartProvider>
      </CustomerSessionProvider>
    </QueryClientProvider>
  );
}
