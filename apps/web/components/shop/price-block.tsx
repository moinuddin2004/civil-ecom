'use client';

import { formatPKR, getUnitPrice, unitLabel, type BulkTier, type Unit } from '@aricon/shared';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BulkPriceLadder } from './bulk-price-ladder';
import { iconProps } from './styles';

export interface PriceBlockProps {
  unit: Unit;
  mrp: number;
  /** Base unit price of the selected variant. */
  price: number;
  bulkTiers: readonly BulkTier[];
  qty: number;
  onQtyChange: (qty: number) => void;
  /** The variant's stock: tier rows and the nudge never set more than this. */
  maxQty?: number;
  /** Out of stock: prices and the ladder show, tier rows don't change the quantity. */
  disabled?: boolean;
  className?: string;
}

/**
 * The product page price block (v2 §1.13 A + B, SPEC §8.5): the unit price for the chosen quantity,
 * MRP and the saving per unit, then the bulk price ladder, or "Same price for any quantity" when the
 * variant has no tiers. Prices come from the shared pricing functions; nothing is computed here.
 */
export function PriceBlock({
  unit,
  mrp,
  price,
  bulkTiers,
  qty,
  onQtyChange,
  maxQty,
  disabled = false,
  className,
}: PriceBlockProps) {
  const { unitPrice } = getUnitPrice({ price, bulkTiers }, qty);
  const saving = mrp - unitPrice;
  const one = unitLabel(unit, 1);

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-col gap-1">
        {/* Announced when a new tier applies. */}
        <p className="flex items-baseline gap-1.5" aria-live="polite" aria-atomic="true">
          <span className="type-price-lg">{formatPKR(unitPrice)}</span>
          <span className="text-base text-ink-700">
            <span aria-hidden="true">/ </span>
            <span className="sr-only">per </span>
            {one}
          </span>
        </p>
        {saving > 0 ? (
          <p className="flex flex-wrap items-baseline gap-2.5 text-sm">
            <s className="text-cement tabular-nums">
              <span className="sr-only">MRP </span>
              {formatPKR(mrp)}
            </s>
            <span className="font-medium text-success tabular-nums">
              Save {formatPKR(saving)} per {one}
            </span>
          </p>
        ) : null}
      </div>

      {bulkTiers.length > 0 ? (
        <BulkPriceLadder
          unit={unit}
          price={price}
          bulkTiers={bulkTiers}
          qty={qty}
          onQtyChange={onQtyChange}
          maxQty={maxQty}
          disabled={disabled}
        />
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-700">
          <Check {...iconProps} className="size-5 shrink-0" />
          Same price for any quantity
        </p>
      )}
    </div>
  );
}
