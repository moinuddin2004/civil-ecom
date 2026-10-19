import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AccountNav } from '@/components/account/account-nav';
import { StorefrontShell } from '@/components/shop/storefront-shell';
import { requireCustomer } from '@/lib/api-server';
import { routes } from '@/lib/routes';

/** Every page under /account is private, so none of them belong in search results (SPEC §9). */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Account section (SPEC §9) inside the storefront header and footer: side navigation on desktop,
 * a tab bar on mobile (`AccountNav`). Signed-out visitors go to log in and come back here.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  await requireCustomer(routes.account);

  return (
    <StorefrontShell>
      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 md:px-8 md:py-10 lg:flex-row lg:gap-10">
        <AccountNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </StorefrontShell>
  );
}
