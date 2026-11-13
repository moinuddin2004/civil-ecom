'use client';

import { formatDateTime, ROLE_LABELS, type AdminMeDTO } from '@aricon/shared';
import { ChevronDown, KeyRound, LogOut, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { sidebarCollapsedStore } from '@/lib/admin/sidebar-store';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useAdminSession } from '@/lib/admin/session';
import { useLocalStore } from '@/lib/local-store';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { ADMIN_NAV_ITEMS, isActive } from './admin-nav';

export interface AdminTopbarProps {
  me: AdminMeDTO;
}

/** Two letters for the avatar circle: the first letters of the first and last name. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}` : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/** Top bar (DESIGN.md §9): sidebar collapse toggle, global order search, user dropdown (name, email, role, change password, log out); carries the mobile nav strip. */
export function AdminTopbar({ me }: AdminTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAdminSession();
  const [query, setQuery] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const items = ADMIN_NAV_ITEMS.filter((item) => item.visible(me));
  const collapsed = useLocalStore(sidebarCollapsedStore);

  async function handleSignOut() {
    setSigningOut(true);
    if (!(await signOut())) {
      toast.error("We couldn't log you out. Check your connection and try again.");
      setSigningOut(false);
    }
  }

  function openOrders(q: string) {
    const href = `/admin/orders?q=${encodeURIComponent(q)}`;
    // Already on the list: the results replace themselves, so Back isn't filled with every letter.
    if (pathname === '/admin/orders') router.replace(href);
    else router.push(href);
  }
  const search = useEffectEvent(openOrders);

  // Search as you type: once typing pauses, the orders list shows the matches.
  const debouncedQuery = useDebouncedValue(query.trim());
  useEffect(() => {
    if (debouncedQuery !== '') search(debouncedQuery);
  }, [debouncedQuery]);

  function submitSearch() {
    const q = query.trim();
    if (q) openOrders(q);
  }

  return (
    <div className="sticky top-0 z-20 border-b border-concrete-150 bg-surface">
      <div className="flex h-14 items-center gap-3 px-4">
        <button
          type="button"
          onClick={() => sidebarCollapsedStore.set(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden size-9 shrink-0 items-center justify-center rounded-md text-ink-700 hover:bg-concrete-50 hover:text-ink lg:flex"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden strokeWidth={1.75} className="size-5" />
          ) : (
            <PanelLeftClose aria-hidden strokeWidth={1.75} className="size-5" />
          )}
        </button>

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Account menu for ${me.user.name}`}
                className="flex h-10 items-center gap-2.5 rounded-lg px-2 hover:bg-concrete-50 data-[state=open]:bg-concrete-50"
              >
                <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                  {initialsOf(me.user.name)}
                </span>
                <span className="hidden flex-col items-start text-left leading-tight sm:flex">
                  <span className="max-w-40 truncate text-sm font-medium text-ink">{me.user.name}</span>
                  <span className="text-xs text-cement">{ROLE_LABELS[me.user.role]}</span>
                </span>
                <ChevronDown aria-hidden strokeWidth={1.75} className="hidden size-4 text-cement sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>
                <p className="truncate text-sm font-semibold text-ink">{me.user.name}</p>
                <p className="truncate text-xs text-cement">{me.user.email}</p>
                <p className="mt-1.5 inline-flex rounded-full bg-concrete-100 px-2 py-0.5 text-xs font-medium text-ink-700">{ROLE_LABELS[me.user.role]}</p>
                {me.user.lastLoginAt ? <p className="mt-1.5 text-xs text-cement">Last login {formatDateTime(me.user.lastLoginAt)}</p> : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={routes.adminChangePassword}>
                  <KeyRound aria-hidden strokeWidth={1.75} />
                  Change password
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={signingOut} onSelect={() => void handleSignOut()} className="text-danger [&_svg]:text-danger">
                <LogOut aria-hidden strokeWidth={1.75} />
                {signingOut ? 'Logging out…' : 'Log out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto border-t border-concrete-150 px-2 py-1.5 scrollbar-none lg:hidden">
        {items.map((item) => {
          const active = isActive(pathname, item.href, items.map((nav) => nav.href));
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
