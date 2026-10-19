import { z } from 'zod';
import { CART_MAX_LINES, QTY_MAX } from '../constants.js';
import { objectIdSchema, qtySchema } from './common.js';

/** Cart requests (SPEC §6.3, §7.2 "Cart"). */

export const cartItemSchema = z.strictObject({
  productId: objectIdSchema,
  variantId: objectIdSchema,
  qty: qtySchema,
});
export type CartItemInput = z.input<typeof cartItemSchema>;

const cartItems = z
  .array(cartItemSchema)
  .max(CART_MAX_LINES, `A cart can hold up to ${CART_MAX_LINES} different items.`);

export const cartQuoteSchema = z.strictObject({
  items: cartItems,
  areaId: objectIdSchema.optional(),
});
export type CartQuoteInput = z.input<typeof cartQuoteSchema>;

/** `qty: 0` removes the line. */
export const setCartItemSchema = z.strictObject({
  variantId: objectIdSchema,
  qty: z.number().int().min(0).max(QTY_MAX),
});
export type SetCartItemInput = z.input<typeof setCartItemSchema>;

export const mergeCartSchema = z.strictObject({ items: cartItems });
export type MergeCartInput = z.input<typeof mergeCartSchema>;

export const cartQuerySchema = z.strictObject({ areaId: objectIdSchema.optional() });
