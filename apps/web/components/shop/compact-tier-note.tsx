'use client';

import { formatNumber, formatPKR, type NextTier } from '@aricon/shared';
import { cn } from '@/lib/utils';
import { TAP_TARGET_TEXT } from './styles';

export interface CompactTierNoteProps {
  /** `minQty` of the tier that applies (from the priced cart line), or null for the base price. */
  appliedTierMinQty: number | null;
  nextTier: NextTier | null;
  /** Makes the nudge a button that sets the quantity to the next tier. */
  onQtyChange?: (qty: number) => void;
  /** Hide the nudge (e.g. while the line has a stock issue, v2 §5.1). */
  showNudge?: boolean;
  className?: string;
}

/**
 * The cart version of the ladder (v2 §5.1, DESIGN.md §6.3): "Bulk price applied (10+)." and
 * "Add 38 more to pay Rs 1,410 each." (no unit word, with a full stop).
 */
export function CompactTierNote({
  appliedTierMinQty,
  nextTier,
  onQtyChange,
  showNudge = true,
  className,
}: CompactTierNoteProps) {
  const nudge = showNudge ? nextTier : null;
  if (appliedTierMinQty === null && nudge === null) return null;

  const nudgeText = nudge
    ? `Add ${formatNumber(nudge.qtyNeeded)} more to pay ${formatPKR(nudge.price)} each.`
    : null;

  return (
    <div className={cn('flex flex-col items-start gap-0.5', className)}>
      {appliedTierMinQty !== null ? (
        <p className="text-sm font-medium text-success">
          Bulk price applied ({formatNumber(appliedTierMinQty)}+).
        </p>
      ) : null}
      {nudge && onQtyChange ? (
        <button
          type="button"
          onClick={() => onQtyChange(nudge.minQty)}
          className={cn(
            TAP_TARGET_TEXT,
            'text-left text-sm text-blueprint hover:text-blueprint-700 hover:underline',
          )}
        >
          {nudgeText}
        </button>
      ) : nudgeText ? (
        <p className="text-sm text-ink-700">{nudgeText}</p>
      ) : null}
    </div>
  );
}
