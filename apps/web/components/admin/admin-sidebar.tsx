'use client';

import type { AdminMeDTO } from '@aricon/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV_ITEMS } from './admin-nav';

export interface AdminSidebarProps {
  me: AdminMeDTO;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin sidebar (DESIGN.md §9): ink background, white text, amber marker on the active item.
 * Desktop only — `AdminTopbar` carries a horizontal tab strip of the same items on mobile, since
 * this build reuses existing patterns instead of adding a new drawer primitive.
 */
export function AdminSidebar({ me }: AdminSidebarProps) {
  const pathname = usePathname();
  const items = ADMIN_NAV_ITEMS.filter((item) => item.visible(me));

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-1 bg-ink px-3 py-5 lg:flex">
      <Link href="/admin" className="flex items-baseline gap-1.5 px-2 pb-4 font-display text-white">
        <span className="text-xl font-bold tracking-wordmark">ARICON</span>
        <span className="text-lg font-medium text-concrete-400">Admin</span>
      </Link>
      <nav className="flex flex-col gap-0.5" aria-label="Admin sections">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active || undefined}
              className={`relative flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium ${
                active ? 'bg-ink-700 text-white' : 'text-concrete-200 hover:bg-ink-700/60 hover:text-white'
              }`}
            >
              {active ? <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-amber" /> : null}
              <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
