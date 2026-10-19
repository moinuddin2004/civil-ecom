'use client';

import { formatNumber, formatPKR, lineTotal, QTY_MAX, UNIT_LABELS, type Unit } from '@aricon/shared';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuantityStepper } from './quantity-stepper';
import { iconProps } from './styles';

export interface ProductQuantityProps {
  unit: Unit;
  qty: number;
  onQtyChange: (qty: number) => void;
  /** Stock of the selected variant; 0 shows the out-of-stock state. */
  stock: number;
  /** Unit price for `qty` (from `getUnitPrice`). */
  unitPrice: number;
  /** Desktop "Add to cart" (mobile uses the sticky bar). Omit to hide the button. */
  onAdd?: () => void;
  adding?: boolean;
  /** WhatsApp link for "Ask us on WhatsApp when this will be back." */
  whatsappHref?: string | null;
  className?: string;
}

/**
 * Product page quantity, total and add (v2 §1.13 C): stepper clamped to 1…stock with
 * "Only 38 in stock" at the limit, the live line total, and the desktop "Add to cart". Out of stock:
 * disabled stepper, a disabled "Out of stock" button and the WhatsApp note.
 */
export function ProductQuantity({
  unit,
  qty,
  onQtyChange,
  stock,
  unitPrice,
  onAdd,
  adding = false,
  whatsappHref,
  className,
}: ProductQuantityProps) {
  const inStock = stock > 0;

  return (
    <div className={cn('flex flex-col gap-3.5 border-t border-concrete-200 pt-4', className)}>
      <QuantityStepper
        label="Quantity"
        value={qty}
        onChange={onQtyChange}
        max={Math.max(1, stock)}
        size="lg"
        disabled={!inStock}
        unitText={UNIT_LABELS[unit].many}
        // Above 9,999 the cap is the cart limit, not the stock.
        maxHint={inStock && stock <= QTY_MAX ? `Only ${formatNumber(stock)} in stock` : undefined}
      />

      {inStock ? (
        <>
          <p className="flex items-baseline gap-3">
            <span className="w-[72px] text-sm font-medium">Total</span>
            <span className="font-display text-[22px]/7 font-bold tabular-nums">
              {formatPKR(lineTotal(unitPrice, qty))}
            </span>
          </p>
          {onAdd ? (
            <Button size="lg" className="hidden w-full lg:inline-flex" loading={adding} onClick={onAdd}>
              {adding ? null : <ShoppingCart {...iconProps} className="size-6" />}
              Add to cart
            </Button>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-2.5">
          <Button size="lg" disabled className="w-full disabled:text-cement">
            Out of stock
          </Button>
          <p className="text-sm text-ink-700">
            {whatsappHref ? (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="link">
                Ask us on WhatsApp
              </a>
            ) : (
              'Ask us on WhatsApp'
            )}{' '}
            when this will be back.
          </p>
        </div>
      )}
    </div>
  );
}
