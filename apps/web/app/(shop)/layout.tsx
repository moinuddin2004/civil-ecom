import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { StorefrontShell } from '@/components/shop/storefront-shell';

/**
 * Storefront shell. Shop pages are rendered per request (`connection()`), never prerendered at build
 * time: the build runs in CI without the API, and a prerendered page would freeze whatever it saw
 * then. Every API read is still cached in the Next.js data cache (300 s + tags) and refreshed on
 * demand by the API (`/_internal/revalidate`), so a page view costs a render, not API calls.
 */
export default async function ShopLayout({ children }: { children: ReactNode }) {
  await connection();
  return <StorefrontShell>{children}</StorefrontShell>;
}
