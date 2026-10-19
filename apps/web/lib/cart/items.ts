import {
  CART_MAX_LINES,
  computeCart,
  formatNumber,
  QTY_MAX,
  QTY_MIN,
  type CartItem,
  type PricedCart,
} from '@aricon/shared';
import { ApiError } from '../api-errors';

/**
 * Pure cart-item helpers for the guest cart and optimistic updates. Prices are never computed
 * here: the API prices every cart (`POST /api/cart/quote`, `GET /api/cart`).
 */

/** Whole number within 1…9,999 (SPEC §6.2). */
export function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return QTY_MIN;
  return Math.min(QTY_MAX, Math.max(QTY_MIN, Math.trunc(qty)));
}

export function cartLimitError(): ApiError {
  return new ApiError(
    'VALIDATION_ERROR',
    400,
    `Your cart can hold up to ${formatNumber(CART_MAX_LINES)} different items. Remove one to add this.`,
  );
}

/**
 * Adds `item` to `items`: the same variant gets the quantities added (capped at 9,999), a new
 * variant becomes a new line. Throws `cartLimitError()` when a new line would pass 50 lines.
 */
export function addCartItem(items: readonly CartItem[], item: CartItem): CartItem[] {
  const existing = items.find((line) => line.variantId === item.variantId);
  if (existing) {
    return items.map((line) =>
      line.variantId === item.variantId ? { ...line, qty: clampQty(line.qty + item.qty) } : line,
    );
  }
  if (items.length >= CART_MAX_LINES) throw cartLimitError();
  return [...items, { productId: item.productId, variantId: item.variantId, qty: clampQty(item.qty) }];
}

/** Sets a line's quantity; 0 or less removes the line. */
export function setCartItemQty(items: readonly CartItem[], variantId: string, qty: number): CartItem[] {
  if (qty <= 0) return removeCartItem(items, variantId);
  return items.map((line) => (line.variantId === variantId ? { ...line, qty: clampQty(qty) } : line));
}

export function removeCartItem(items: readonly CartItem[], variantId: string): CartItem[] {
  return items.filter((line) => line.variantId !== variantId);
}

/**
 * Optimistic view of a priced cart after a quantity change: removed lines disappear and changed
 * lines show the new quantity at once. Line and cart totals keep their last priced values until
 * the API answers (a few hundred milliseconds), so the UI never shows a price we computed.
 */
export function withItemQuantities(cart: PricedCart, items: readonly CartItem[]): PricedCart {
  const qtyByVariant = new Map(items.map((item) => [item.variantId, item.qty]));
  const lines = cart.lines.flatMap((line) => {
    const qty = qtyByVariant.get(line.variantId);
    if (qty === undefined) return [];
    return [qty === line.qty ? line : { ...line, qty }];
  });
  return { ...cart, lines };
}

/** `withItemQuantities` for one line; qty 0 removes it. */
export function withLineQty(cart: PricedCart, variantId: string, qty: number): PricedCart {
  const lines = cart.lines.flatMap((line) => {
    if (line.variantId !== variantId) return [line];
    return qty > 0 ? [{ ...line, qty }] : [];
  });
  return { ...cart, lines };
}

/** The priced form of an empty cart (no request needed for a guest with nothing in the cart). */
export const EMPTY_CART: PricedCart = computeCart([], null, { defaultDeliveryFee: 0 });

/** Narrows an API envelope to `{ data: PricedCart }` without trusting its shape blindly. */
export function extractPricedCart(value: unknown): PricedCart | null {
  if (typeof value !== 'object' || value === null || !('data' in value)) return null;
  const data: unknown = value.data;
  if (typeof data !== 'object' || data === null) return null;
  const candidate = data as Partial<Record<keyof PricedCart, unknown>>;
  if (!Array.isArray(candidate.lines) || typeof candidate.subtotal !== 'number') return null;
  return data as PricedCart;
}
