import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { toListItems } from './list-items';

/** SPEC §15: 2 columns (M), 3 (tablet), 4 (D); v2 gaps 12 / 24. */
export const PRODUCT_GRID_CLASS = 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-6';

export interface ProductGridProps {
  /** Product cards (or skeletons); each is wrapped in an `<li>`. */
  children: ReactNode;
  /** 5 columns from 1440 px, for pages without the filter sidebar. */
  columns?: 4 | 5;
  'aria-label'?: string;
  className?: string;
}

export function ProductGrid({
  children,
  columns = 4,
  'aria-label': ariaLabel,
  className,
}: ProductGridProps) {
  return (
    <ul
      aria-label={ariaLabel}
      className={cn(PRODUCT_GRID_CLASS, columns === 5 && 'xl:grid-cols-5', className)}
    >
      {toListItems(children, 'flex min-w-0')}
    </ul>
  );
}
