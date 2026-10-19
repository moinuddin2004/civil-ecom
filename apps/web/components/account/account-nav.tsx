'use client';

import { LayoutGrid, LogOut, MapPin, Package, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { routes } from '@/lib/routes';
import { useCustomerLogout } from '@/lib/session/use-customer-logout';
import { cn } from '@/lib/utils';

/**
 * Account section navigation (SPEC §9): a horizontal scrollable tab bar on mobile, a side
 * navigation on desktop (DESIGN.md §8.10 "Mobile: tabs at the top ... Desktop: left navigation").
 * Both read from the same list so the active route always agrees, and both end with "Log out".
 */
const NAV_ITEMS = [
  { href: routes.account, label: 'Overview', icon: LayoutGrid },
  { href: routes.accountOrders, label: 'Orders', icon: Package },
  { href: routes.accountAddresses, label: 'Addresses', icon: MapPin },
  { href: routes.accountProfile, label: 'Profile', icon: User },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === routes.account) return pathname === routes.account;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountNav() {
  const pathname = usePathname();
  const { logout, loggingOut } = useCustomerLogout();

  async function handleLogout() {
    if (!(await logout())) toast.error("We couldn't log you out. Check your connection and try again.");
  }

  return (
    <>
      <nav
        aria-label="Account"
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-concrete-200 px-4 pb-px scrollbar-none lg:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap',
                active ? 'border-ink text-ink' : 'border-transparent text-cement hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void handleLogout()}
          className="ml-auto flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-cement hover:text-ink disabled:opacity-60"
        >
          Log out
        </button>
      </nav>

      <nav aria-label="Account" className="hidden w-56 shrink-0 flex-col gap-1 lg:flex">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-ink text-white' : 'text-ink-700 hover:bg-concrete-50',
              )}
            >
              <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        <div className="mt-2 border-t border-concrete-150 pt-2">
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-concrete-50 disabled:opacity-60"
          >
            <LogOut aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
            Log out
          </button>
        </div>
      </nav>
    </>
  );
}
