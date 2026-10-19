import { formatNumber } from '@aricon/shared';
import { SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { iconProps } from './styles';

export interface ProductListingShellProps {
  /** Current result count, for the mobile sheet's sticky "Show N products" button. */
  total: number;
  /** Badge count for the mobile "Filters (n)" button. */
  activeFilterCount: number;
  mobileFilterPanel: ReactNode;
  desktopFilterPanel: ReactNode;
  sortSelect: ReactNode;
  activeChips?: ReactNode;
  /** Grid, pagination and/or the empty state. */
  children: ReactNode;
  className?: string;
}

/**
 * Category/brand/search listing shell (DESIGN.md §6 "Filter panel", §8.3 "Category page"): a
 * ~260 px filter sidebar from `lg`, a "Filters (n)" full-screen sheet below it, a sort control,
 * active-filter chips, then whatever the page passes as `children`. Stays a Server Component —
 * `Dialog` is uncontrolled (Radix manages its own open state), so no client boundary is needed
 * here; only `SortSelect` (passed in as a prop) is a client component.
 */
export function ProductListingShell({
  total,
  activeFilterCount,
  mobileFilterPanel,
  desktopFilterPanel,
  sortSelect,
  activeChips,
  children,
  className,
}: ProductListingShellProps) {
  return (
    <div className={cn('flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8', className)}>
      <aside className="hidden w-[260px] shrink-0 lg:block">
        <div className="rounded-xl border border-concrete-150 bg-surface p-4">{desktopFilterPanel}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  <SlidersHorizontal {...iconProps} className="size-4" />
                  {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
                </Button>
              </DialogTrigger>
              <DialogContent mobile="sheet" aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle>Filters</DialogTitle>
                  <DialogCloseButton />
                </DialogHeader>
                <DialogBody>{mobileFilterPanel}</DialogBody>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button className="w-full">Show {formatNumber(total)} products</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="ml-auto w-[168px] shrink-0 sm:w-[200px]">{sortSelect}</div>
        </div>

        {activeChips}
        {children}
      </div>
    </div>
  );
}

export interface ListingEmptyStateProps {
  message: string;
  actionLabel: string;
  actionHref: string;
}

/** DESIGN.md §6 "Empty states": a short line and one action. */
export function ListingEmptyState({ message, actionLabel, actionHref }: ListingEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-concrete-150 bg-surface px-6 py-16 text-center">
      <p className="max-w-[42ch] text-ink-700">{message}</p>
      <Button asChild variant="secondary">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
