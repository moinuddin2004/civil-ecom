import { formatPKR, type PricedCart } from '@aricon/shared';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FreeDeliveryProgress } from './free-delivery-progress';
import { CARD_CLASS } from './styles';

export interface OrderSummaryProps {
  pricedCart: PricedCart;
  /** The cart's free-delivery measured bar (DESIGN.md §4.5) — checkout does not show it again. */
  showFreeDeliveryProgress?: boolean;
  /** A "Checkout" / "Place order" button, and any inline form error above it. */
  children?: ReactNode;
  className?: string;
}

/**
 * Subtotal / delivery / total panel shared by the cart and checkout (DESIGN.md §6 "Order
 * summary"): same layout in both places, per CLAUDE.md 2.5 (reuse existing patterns).
 */
export function OrderSummary({ pricedCart, showFreeDeliveryProgress, children, className }: OrderSummaryProps) {
  return (
    <div className={cn(CARD_CLASS, 'flex flex-col gap-4 p-4', className)}>
      {pricedCart.area ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-700">Delivering to</span>
          <span className="font-medium text-ink">{pricedCart.area.name}</span>
        </div>
      ) : null}

      {showFreeDeliveryProgress ? (
        <FreeDeliveryProgress
          subtotal={pricedCart.subtotal}
          freeDeliveryAbove={pricedCart.area?.freeDeliveryAbove ?? null}
          amountToFreeDelivery={pricedCart.amountToFreeDelivery}
        />
      ) : null}

      <div className="flex flex-col gap-2 border-t border-concrete-150 pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-700">Subtotal</span>
          <span className="font-medium text-ink tabular-nums">{formatPKR(pricedCart.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-700">Delivery</span>
          <span className="font-medium text-ink tabular-nums">
            {pricedCart.deliveryFee !== null ? formatPKR(pricedCart.deliveryFee) : 'Choose a delivery area'}
          </span>
        </div>
      </div>

      <div className="flex items-baseline justify-between border-t border-concrete-150 pt-4">
        <span className="type-h3">Total</span>
        <span className="type-price">{formatPKR(pricedCart.total)}</span>
      </div>

      {children}
    </div>
  );
}
