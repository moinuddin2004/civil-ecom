'use client';

import { formatPKR, type DeliveryAreaDTO } from '@aricon/shared';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart/cart-context';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { AreaSelector } from './area-selector';
import { CartLineRow } from './cart-line-row';
import { OrderSummary } from './order-summary';
import { CartLinesSkeleton, Skeleton } from './skeleton';
import { CARD_CLASS, iconProps } from './styles';

export interface CartViewProps {
  areas: DeliveryAreaDTO[];
}

function CartLoading() {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 md:px-8 md:py-10 lg:flex-row lg:items-start">
      <div className="flex-1">
        <CartLinesSkeleton />
      </div>
      <Skeleton className="h-56 w-full rounded-xl lg:w-[360px] lg:shrink-0" />
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="mx-auto flex max-w-content flex-col items-center gap-4 px-4 py-16 text-center md:px-8">
      <ShoppingCart {...iconProps} className="size-12 text-concrete-400" />
      <h1 className="type-h2">Your cart is empty.</h1>
      <p className="text-ink-700">Browse cement, wires and pipes.</p>
      <Button asChild size="lg">
        <Link href={routes.home}>Browse categories</Link>
      </Button>
    </div>
  );
}

/**
 * The cart page (SPEC §8.6, DESIGN.md §8.6): lines on the left, order summary on the right on
 * desktop; a sticky total + "Checkout" bar on mobile. Prices always come from `useCart()`
 * (`computeCart()` over the guest cart in localStorage) — never computed here.
 */
export function CartView({ areas }: CartViewProps) {
  const { pricedCart, areaId, ready } = useCart();

  if (!ready) return <CartLoading />;
  if (pricedCart.lines.length === 0) return <EmptyCart />;

  const canCheckout = pricedCart.issues.length === 0;
  const itemCount = pricedCart.itemCount;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 pb-28 md:px-8 md:py-10 lg:flex-row lg:items-start lg:pb-10">
      <div className="flex flex-1 flex-col gap-4">
        <h1 className="type-h1">
          Your cart ({itemCount} item{itemCount === 1 ? '' : 's'})
        </h1>
        <div className={cn(CARD_CLASS, 'divide-y divide-concrete-150')}>
          {pricedCart.lines.map((line) => (
            <CartLineRow key={line.variantId} line={line} />
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col gap-4 lg:w-[360px] lg:shrink-0">
        {!areaId ? (
          <div className={cn(CARD_CLASS, 'flex flex-col gap-3 p-4')}>
            <p className="text-sm font-medium text-ink">Choose your delivery area to see the delivery fee.</p>
            <AreaSelector areas={areas} tone="onSurface" />
          </div>
        ) : null}

        <OrderSummary pricedCart={pricedCart} showFreeDeliveryProgress>
          {canCheckout ? (
            <Button asChild size="lg" className="w-full">
              <Link href={routes.checkout}>Checkout</Link>
            </Button>
          ) : (
            <Button size="lg" className="w-full" disabled>
              Checkout
            </Button>
          )}
        </OrderSummary>
      </div>

      <div
        data-mobile-sticky-bar
        className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-concrete-150 bg-surface px-4 py-3 shadow-float-up lg:hidden"
      >
        <div className="flex flex-col">
          <span className="text-xs text-cement">Total</span>
          <span className="type-price">{formatPKR(pricedCart.total)}</span>
        </div>
        {canCheckout ? (
          <Button asChild size="lg" className="max-w-[200px] flex-1">
            <Link href={routes.checkout}>Checkout</Link>
          </Button>
        ) : (
          <Button size="lg" className="max-w-[200px] flex-1" disabled>
            Checkout
          </Button>
        )}
      </div>
    </div>
  );
}
