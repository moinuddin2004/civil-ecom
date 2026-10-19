import { formatPKR, unitLabel, type Unit } from '@aricon/shared';
import { cn } from '@/lib/utils';

const SIZES = {
  /** Product page: Barlow 34/38 + "/ bag" 16 px ink-700 (v2 §1.13 A). */
  lg: { root: 'gap-1.5', amount: 'type-price-lg', unit: 'text-base text-ink-700' },
  /** Product card: Barlow 22/26 + "/ bag" 14 px cement (v2 §1.12). */
  md: { root: 'gap-1', amount: 'type-price', unit: 'text-sm text-cement' },
  /** Cart line: Barlow 18/22 + "/ bag" 14 px cement (v2 §5.1). */
  sm: {
    root: 'gap-1',
    amount: 'font-display text-lg/[22px] font-bold tabular-nums',
    unit: 'text-sm text-cement',
  },
} as const;

export type PriceSize = keyof typeof SIZES;

export interface PriceProps {
  /** Integer PKR. */
  amount: number;
  /** Adds "/ bag" after the amount. */
  unit?: Unit | null;
  size?: PriceSize;
  /** Words before the amount inside the price, e.g. "From" → "From Rs 7,450". */
  prefix?: string;
  className?: string;
}

/** A price in Barlow with tabular numbers, optionally "/ {unit}". Always formatted by `formatPKR`. */
export function Price({ amount, unit, size = 'md', prefix, className }: PriceProps) {
  const style = SIZES[size];
  return (
    <span className={cn('inline-flex flex-wrap items-baseline', style.root, className)}>
      <span className={style.amount}>
        {prefix ? `${prefix} ` : null}
        {formatPKR(amount)}
      </span>
      {unit ? (
        <span className={style.unit}>
          <span aria-hidden="true">/ </span>
          <span className="sr-only">per </span>
          {unitLabel(unit, 1)}
        </span>
      ) : null}
    </span>
  );
}
