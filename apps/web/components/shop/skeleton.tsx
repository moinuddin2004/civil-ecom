import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CARD_CLASS } from './styles';

/*
 * Skeletons: concrete blocks on the final layout (v2 §1.25). They do not pulse: motion only follows
 * a person's action (SPEC §15).
 */

/** One concrete block; size and radius come from `className` (radius 4 by default). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('rounded-xs bg-concrete', className)} />;
}

/** Announces a loading region once; wrap skeleton blocks in it. */
export function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Cart line placeholder (v2 §5.1 geometry). */
export function CartLineSkeleton() {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 border-t border-concrete-200 p-4 first:border-t-0 lg:grid-cols-[96px_minmax(0,1fr)]">
      <Skeleton className="size-[72px] rounded-md lg:size-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-[18px] w-24" />
        <div className="mt-2 flex items-center justify-between gap-3">
          <Skeleton className="h-12 w-[150px] rounded-md lg:h-11" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
    </div>
  );
}

/** A card of cart line placeholders. */
export function CartLinesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading your cart…" className={CARD_CLASS}>
      {Array.from({ length: count }, (_, index) => (
        <CartLineSkeleton key={index} />
      ))}
    </LoadingRegion>
  );
}

/** Account table rows, 56 px each (v2 §11). */
export function OrderRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading orders…" className={cn(CARD_CLASS, 'overflow-hidden')}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex h-14 items-center justify-between gap-3 border-t border-concrete-200 px-4 first:border-t-0"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </LoadingRegion>
  );
}
