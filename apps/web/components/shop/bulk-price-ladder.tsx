'use client';

import {
  activeLadderIndex,
  formatNumber,
  formatPKR,
  formatQty,
  ladderMarkerPercent,
  nextTier,
  priceLadder,
  UNIT_LABELS,
  unitLabel,
  type BulkTier,
  type LadderRow,
  type Unit,
} from '@aricon/shared';
import { Fragment, useId } from 'react';
import { cn } from '@/lib/utils';
import { TAP_TARGET_36 } from './styles';

/** "1–9 bags", "10–49 bags", "100+ bags": en dash, always the plural unit (v2 §1.13 B3). */
export function tierRangeLabel(row: LadderRow, unit: Unit): string {
  const many = UNIT_LABELS[unit].many;
  if (row.maxQty === null) return `${formatNumber(row.minQty)}+ ${many}`;
  // A one-quantity row (tiers at 2, 3, …) reads "2 bags", not "2–2 bags".
  if (row.maxQty === row.minQty) return `${formatNumber(row.minQty)} ${unitLabel(unit, row.minQty)}`;
  return `${formatNumber(row.minQty)}–${formatNumber(row.maxQty)} ${many}`;
}

/**
 * How far the marker label shifts left, in % of its own width. Centred (50%) in the middle of the
 * scale, easing to 20% / 80% at the ends so a long label ("1,000 bags") never runs past the scale's
 * 12 px margin and scrolls a 390 px screen sideways. The triangle itself always sits on the point.
 */
function markerLabelShift(percent: number): number {
  if (percent < 25) return 20 + (percent / 25) * 30;
  if (percent > 75) return 50 + ((percent - 75) / 25) * 30;
  return 50;
}

export interface BulkPriceLadderProps {
  unit: Unit;
  /** Base unit price (the "1–9" row). */
  price: number;
  bulkTiers: readonly BulkTier[];
  qty: number;
  onQtyChange: (qty: number) => void;
  /** Rows and the nudge never set more than this (the variant's stock). */
  maxQty?: number;
  /** Out of stock: the ladder still shows, but rows don't change the quantity. */
  disabled?: boolean;
  className?: string;
}

/**
 * The bulk price ladder (v2 §1.13 B, DESIGN.md §6.3): "Price for your quantity", the dimension-line
 * scale with the quantity marker, the tier rows (active row highlighted, click to jump to a tier) and
 * the next-tier nudge. Render it only when the variant has bulk tiers.
 */
export function BulkPriceLadder({
  unit,
  price,
  bulkTiers,
  qty,
  onQtyChange,
  maxQty,
  disabled = false,
  className,
}: BulkPriceLadderProps) {
  const labelId = useId();
  const ladder = priceLadder({ price, bulkTiers });
  const active = activeLadderIndex(ladder, qty);
  const marker = ladderMarkerPercent(ladder, qty);
  const next = nextTier({ bulkTiers }, qty);
  const lastIndex = ladder.length - 1;
  const limit = maxQty === undefined ? Number.POSITIVE_INFINITY : Math.max(1, maxQty);
  // Don't promise a tier the stock can't reach.
  const nudge = next !== null && !disabled && next.minQty <= limit ? next : null;

  const setQty = (target: number) => onQtyChange(Math.max(1, Math.min(target, limit)));

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <p id={labelId} className="text-sm font-semibold">
        Price for your quantity
      </p>

      {/* The scale repeats the rows below, so screen readers skip it. */}
      <div aria-hidden="true" className="relative mx-3 h-[58px]">
        <div className="absolute inset-x-0 top-[22px] h-px bg-ink-700" />
        {ladder.map((row, index) => {
          // Ticks are evenly spaced, not proportional to the quantities (v2 §1.13 B2).
          const left = `${lastIndex > 0 ? (index / lastIndex) * 100 : 0}%`;
          return (
            <Fragment key={row.minQty}>
              <span className="absolute top-4 h-[13px] w-px bg-ink-700" style={{ left }} />
              <span
                className="absolute top-0 -translate-x-1/2 text-xs/[14px] font-medium text-ink-700 tabular-nums"
                style={{ left }}
              >
                {formatNumber(row.minQty)}
                {index === lastIndex ? '+' : null}
              </span>
            </Fragment>
          );
        })}
        <div
          className="absolute top-[26px] transition-[left] duration-150 ease-out"
          style={{ left: `${marker}%` }}
        >
          <span className="absolute top-0 left-0 block size-0 -translate-x-1/2 border-x-[6px] border-b-8 border-x-transparent border-b-ink" />
          <span
            className="absolute top-[9px] left-0 text-xs font-semibold whitespace-nowrap tabular-nums transition-transform duration-150 ease-out"
            style={{ transform: `translateX(-${markerLabelShift(marker)}%)` }}
          >
            {formatQty(qty, unit)}
          </span>
        </div>
      </div>

      <div
        role="group"
        aria-labelledby={labelId}
        className="overflow-hidden rounded-md border border-concrete-200 bg-surface"
      >
        {ladder.map((row, index) => {
          const isActive = index === active;
          return (
            <button
              key={row.minQty}
              type="button"
              aria-pressed={isActive}
              disabled={disabled}
              onClick={() => setQty(row.minQty)}
              className={cn(
                'flex w-full justify-between gap-3 border-t border-concrete-200 py-[11px] pr-3.5 pl-[18px] text-left text-[15px]/[22px] tabular-nums first:border-t-0',
                'transition-[background-color,box-shadow] duration-150 ease-out',
                'focus-visible:-outline-offset-2 disabled:cursor-default',
                isActive
                  ? 'bg-amber-100 font-semibold shadow-[inset_4px_0_0_var(--color-amber)]'
                  : 'bg-surface enabled:hover:bg-concrete-50',
              )}
            >
              <span>{tierRangeLabel(row, unit)}</span>
              <span>{formatPKR(row.price)}</span>
            </button>
          );
        })}
      </div>

      {nudge ? (
        <button
          type="button"
          onClick={() => setQty(nudge.minQty)}
          className={cn(
            TAP_TARGET_36,
            'min-h-9 self-start py-1.5 text-left text-sm font-medium whitespace-normal text-blueprint',
            'hover:text-blueprint-700 hover:underline',
          )}
        >
          Add {formatNumber(nudge.qtyNeeded)} more {unitLabel(unit, nudge.qtyNeeded)} to pay{' '}
          {formatPKR(nudge.price)} each
        </button>
      ) : null}
    </div>
  );
}
