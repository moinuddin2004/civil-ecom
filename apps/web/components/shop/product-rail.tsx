import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { toListItems } from './list-items';
import { LINK_BUTTON_CLASS } from './styles';

/** Card width 160 px (M) / 200 px (tablet) / 5 visible (D): `(100% − 4 gaps of 24) / 5`. */
export const PRODUCT_RAIL_IMAGE_SIZES = '(min-width: 1024px) 240px, (min-width: 768px) 200px, 160px';

export interface ProductRailProps {
  /** Product cards; each is wrapped in a snapping `<li>`. */
  children: ReactNode;
  'aria-label'?: string;
  className?: string;
}

/**
 * Horizontal row of product cards (v2 §2.3 "Product rows"). On mobile it bleeds to the screen edges
 * (the page container has a 16 px gutter) and snaps card by card.
 * The 4 px vertical padding keeps the 3 px hover lift from being clipped by the scroller.
 * `relative` makes the scroller the containing block of the cards' `sr-only` text: without it those
 * absolutely positioned spans escape the scroll clip and widen the whole page.
 */
export function ProductRail({ children, 'aria-label': ariaLabel, className }: ProductRailProps) {
  return (
    <ul
      aria-label={ariaLabel}
      className={cn(
        'relative -mx-4 grid snap-x snap-mandatory auto-cols-[160px] grid-flow-col gap-3 overflow-x-auto scroll-px-4 px-4 py-1 scrollbar-none',
        'md:auto-cols-[200px]',
        'lg:mx-0 lg:auto-cols-[calc((100%-96px)/5)] lg:gap-6 lg:scroll-px-0 lg:px-0',
        className,
      )}
    >
      {toListItems(children, 'flex min-w-0 snap-start')}
    </ul>
  );
}

export interface ProductSectionProps {
  title: string;
  /** Adds "See all" at the right of the heading. */
  seeAllHref?: string;
  children: ReactNode;
  className?: string;
}

/** A home or product-page section: H2, optional "See all", then the rail. */
export function ProductSection({ title, seeAllHref, children, className }: ProductSectionProps) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="type-h2">{title}</h2>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            aria-label={`See all: ${title}`}
            className={cn(LINK_BUTTON_CLASS, 'flex min-h-11 shrink-0 items-center px-1 text-sm')}
          >
            See all
          </Link>
        ) : null}
      </div>
      <ProductRail aria-label={title}>{children}</ProductRail>
    </section>
  );
}
