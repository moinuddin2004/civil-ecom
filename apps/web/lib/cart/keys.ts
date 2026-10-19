import type { CartItem } from '@aricon/shared';

/**
 * React Query keys for carts. Both include the delivery area, so choosing another area reprices
 * the cart by itself. Invalidate `cartQueryKeys.all` after anything that changes the cart on the
 * server (order placed, reorder, merge).
 */
export const cartQueryKeys = {
  all: ['cart'] as const,
  customerAll: ['cart', 'customer'] as const,
  customer: (areaId: string | null) => ['cart', 'customer', areaId ?? 'no-area'] as const,
  quote: (areaId: string | null, items: readonly CartItem[]) =>
    ['cart', 'quote', areaId ?? 'no-area', items] as const,
};
