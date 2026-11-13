'use client';

import type { AdminMeDTO } from '@aricon/shared';
import { ExternalLink, Store } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { sidebarCollapsedStore } from '@/lib/admin/sidebar-store';
import { useLocalStore } from '@/lib/local-store';
import { cn } from '@/lib/utils';
import { isActive, visibleNavGroups } from './admin-nav';

export interface AdminSidebarProps {
  me: AdminMeDTO;
}

/**
 * Admin sidebar (DESIGN.md §9): ink background, white text, amber marker on the active item. The
 * items are split into labelled sections (Overview, Sales, Catalog, Store, System), and each one
 * has a tooltip saying what it is for. Desktop only — `AdminTopbar` carries a horizontal tab strip
 * of the same items on mobile.
 *
 * It is a full-height sticky column, so the page scrolls next to it instead of moving it. The
 * "Collapse" control turns it into an icon rail (labels become tooltips and screen-reader text,
 * section titles become thin dividers).
 */
export function AdminSidebar({ me }: AdminSidebarProps) {
  const pathname = usePathname();
  const groups = visibleNavGroups(me);
  const allHrefs = groups.flatMap((group) => group.items.map((item) => item.href));
  const collapsed = useLocalStore(sidebarCollapsedStore);

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col bg-ink py-5 transition-[width,padding] duration-150 ease-out motion-reduce:transition-none lg:flex',
        collapsed ? 'w-16 px-2' : 'w-60 px-3',
      )}
    >
      <Link
        href="/admin"
        aria-label="ARICON Admin home"
        className={cn('flex shrink-0 items-baseline gap-1.5 pb-4 font-display text-white', collapsed ? 'justify-center' : 'px-2')}
      >
        {collapsed ? (
          <span className="flex size-8 items-center justify-center rounded-md bg-amber font-display text-base font-bold text-ink">
            A
          </span>
        ) : (
          <>
            <span className="text-xl font-bold tracking-wordmark">ARICON</span>
            <span className="text-lg font-medium text-concrete-400">Admin</span>
          </>
        )}
      </Link>

      {/* The sidebar stays put while the page scrolls; only the nav scrolls if it outgrows the screen. */}
      <nav className="scrollbar-slim -mr-1 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1" aria-label="Admin sections">
        {groups.map((group, groupIndex) => (
          <div
            key={group.label}
            role="group"
            aria-label={group.label}
            className={cn('flex flex-col gap-0.5', groupIndex > 0 && (collapsed ? 'mt-2 border-t border-ink-700 pt-2' : 'mt-5'))}
          >
            {collapsed ? null : (
              <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-concrete-400 uppercase">{group.label}</p>
            )}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href, allHrefs);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active || undefined}
                  title={collapsed ? `${item.label}: ${item.description}` : item.description}
                  className={cn(
                    'relative flex h-10 shrink-0 items-center gap-3 rounded-md text-sm font-medium',
                    collapsed ? 'justify-center' : 'px-3',
                    active ? 'bg-ink-700 text-white' : 'text-concrete-200 hover:bg-ink-700/60 hover:text-white',
                  )}
                >
                  {active ? <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-amber" /> : null}
                  <Icon aria-hidden strokeWidth={1.75} className={cn('size-5 shrink-0', active ? 'text-amber' : 'text-concrete-400')} />
                  {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Back to the customer side, in a new tab so the admin session stays where it is. */}
      <Link
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        title="Open the shop in a new tab"
        className={cn(
          'mt-3 flex h-10 shrink-0 items-center gap-3 rounded-md border border-ink-700 text-sm font-medium text-concrete-200 hover:bg-ink-700/60 hover:text-white',
          collapsed ? 'justify-center' : 'px-3',
        )}
      >
        <Store aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-concrete-400" />
        {collapsed ? (
          <span className="sr-only">View shop</span>
        ) : (
          <>
            View shop
            <ExternalLink aria-hidden strokeWidth={1.75} className="ml-auto size-4 text-concrete-400" />
          </>
        )}
      </Link>
    </aside>
  );
}
