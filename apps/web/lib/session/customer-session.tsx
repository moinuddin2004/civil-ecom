'use client';

import type { CustomerDTO } from '@aricon/shared';
import { createContext, useContext, type ReactNode } from 'react';

/**
 * The signed-in customer as the server saw it for this page (null for guests). Rendered by the root
 * layout, so `router.refresh()` after login or logout updates it everywhere without a reload.
 */
const CustomerSessionContext = createContext<CustomerDTO | null>(null);

export function CustomerSessionProvider({ customer, children }: { customer: CustomerDTO | null; children: ReactNode }) {
  return <CustomerSessionContext.Provider value={customer}>{children}</CustomerSessionContext.Provider>;
}

export function useCustomer(): CustomerDTO | null {
  return useContext(CustomerSessionContext);
}
