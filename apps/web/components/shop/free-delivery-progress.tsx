import { formatPKR } from '@aricon/shared';
import { cn } from '@/lib/utils';

export interface FreeDeliveryProgressProps {
  subtotal: number;
  /** null → this area has no free-delivery threshold; the bar is not shown. */
  freeDeliveryAbove: number | null;
  /** 0 once reached, null when there is no threshold (mirrors `PricedCart.amountToFreeDelivery`). */
  amountToFreeDelivery: number | null;
  className?: string;
}

const TICKS = [0, 25, 50, 75, 100] as const;

/**
 * The free-delivery measured bar (DESIGN.md §4.5, §8.6): the same dimension-line construction as
 * the bulk price ladder's quantity scale (`bulk-price-ladder.tsx` — a thin ink line, evenly spaced
 * ticks and a triangular marker), applied to progress toward free delivery instead of a chosen
 * quantity, so the one visual motif reads as one system everywhere it appears. This is one of only
 * two places it's allowed to appear (DESIGN.md §4.5) — don't reuse it decoratively elsewhere.
 */
export function FreeDeliveryProgress({
  subtotal,
  freeDeliveryAbove,
  amountToFreeDelivery,
  className,
}: FreeDeliveryProgressProps) {
  if (freeDeliveryAbove === null || freeDeliveryAbove <= 0) return null;

  const reached = amountToFreeDelivery === 0;
  const percent = Math.round(Math.min(1, Math.max(0, subtotal / freeDeliveryAbove)) * 100);

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <p className="text-sm font-medium text-ink">
        {reached
          ? "You've unlocked free delivery."
          : `Add ${formatPKR(amountToFreeDelivery ?? freeDeliveryAbove - subtotal)} more for free delivery.`}
      </p>
      <div aria-hidden="true" className="relative mx-3 h-4">
        <div className="absolute inset-x-0 top-2 h-px bg-ink-700" />
        <div
          className="absolute top-2 left-0 h-px bg-amber transition-[width] duration-150 ease-out"
          style={{ width: `${percent}%` }}
        />
        {TICKS.map((tick) => (
          <span key={tick} className="absolute top-1 h-2 w-px bg-ink-700" style={{ left: `${tick}%` }} />
        ))}
        <div className="absolute top-0 transition-[left] duration-150 ease-out" style={{ left: `${percent}%` }}>
          <span className="absolute top-0 left-0 block size-0 -translate-x-1/2 border-x-[6px] border-b-8 border-x-transparent border-b-ink" />
        </div>
      </div>
      <p className="sr-only">{percent}% of the way to free delivery.</p>
    </div>
  );
}
