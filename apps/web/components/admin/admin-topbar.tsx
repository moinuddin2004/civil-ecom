'use client';

import { ROLE_LABELS, type AdminMeDTO } from '@aricon/shared';
import { LogOut, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAdminSession } from '@/lib/admin/session';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { ADMIN_NAV_ITEMS } from './admin-nav';

export interface AdminTopbarProps {
  me: AdminMeDTO;
}

/** Top bar (DESIGN.md §9): global order search, user menu with role; carries the mobile nav strip. */
export function AdminTopbar({ me }: AdminTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAdminSession();
  const [query, setQuery] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const items = ADMIN_NAV_ITEMS.filter((item) => item.visible(me));

  async function handleSignOut() {
    setSigningOut(true);
    if (!(await signOut())) {
      toast.error("We couldn't log you out. Check your connection and try again.");
      setSigningOut(false);
    }
  }

  function submitSearch() {
    const q = query.trim();
    if (q) router.push(`/admin/orders?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="sticky top-0 z-20 border-b border-concrete-150 bg-surface">
      <div className="flex h-14 items-center gap-3 px-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
          className="flex h-9 max-w-xs flex-1 items-center gap-2 rounded-md border border-concrete-400 bg-surface px-3"
        >
          <Search aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-cement" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search orders by number or phone"
            aria-label="Search orders"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-cement"
          />
        </form>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-ink">{me.user.name}</p>
            <p className="text-xs text-cement">{ROLE_LABELS[me.user.role]}</p>
          </div>
          <Link href={routes.adminChangePassword} className="text-sm font-medium text-blueprint hover:text-blueprint-700">
            Change password
          </Link>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            aria-label="Log out"
            className="flex size-9 items-center justify-center rounded-md text-ink-700 hover:bg-concrete-50 hover:text-ink disabled:opacity-60"
          >
            <LogOut aria-hidden strokeWidth={1.75} className="size-5" />
          </button>
        </div>
      </div>

      <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto border-t border-concrete-150 px-2 py-1.5 scrollbar-none lg:hidden">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap',
                active ? 'bg-ink text-white' : 'text-ink-700 hover:bg-concrete-50',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
