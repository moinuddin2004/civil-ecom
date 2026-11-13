import { z } from 'zod';
import { CART_MAX_LINES, CUSTOMER_NOTE_MAX, INTERNAL_NOTE_MAX } from '../constants.js';
import { cartItemSchema } from './cart.js';
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from '../enums.js';
import { ORDER_NUMBER_PATTERN, TRACKING_CODE_PATTERN } from '../order-number.js';
import {
  csvQuery,
  dateQuery,
  moneySchema,
  objectIdSchema,
  optionalText,
  pageQuery,
  requiredText,
  sortQuery,
} from './common.js';

/** Orders, payments and receipts (SPEC §6.6–6.8, §7.2, §7.3). */

export const idempotencyKeySchema = z.uuidv4('Idempotency-Key must be a UUID v4.');

export const placeOrderSchema = z.strictObject({
  addressId: objectIdSchema,
  paymentMethod: z.enum(PAYMENT_METHODS),
  customerNote: optionalText(CUSTOMER_NOTE_MAX),
  /** The total the customer saw; a mismatch returns 409 PRICE_CHANGED. */
  expectedTotal: moneySchema,
});
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

/** The customer, address and lines the server prices for staff (`POST /api/admin/orders/quote`). */
export const adminOrderQuoteSchema = z.strictObject({
  userId: objectIdSchema,
  addressId: objectIdSchema,
  /** Rupees off the subtotal; needs `orders.discount` (SPEC §6.6c). */
  discountAmount: moneySchema.optional(),
  items: z.array(cartItemSchema).min(1, 'Add at least one product.').max(CART_MAX_LINES, `An order can have at most ${CART_MAX_LINES} lines.`),
});
export type AdminOrderQuoteInput = z.input<typeof adminOrderQuoteSchema>;

/** `POST /api/admin/orders` (with the `Idempotency-Key` header): a quote plus payment and the total staff saw. */
export const adminCreateOrderSchema = z.strictObject({
  ...adminOrderQuoteSchema.shape,
  paymentMethod: z.enum(PAYMENT_METHODS),
  customerNote: optionalText(CUSTOMER_NOTE_MAX),
  /** Required when `discountAmount` is more than 0. */
  discountReason: optionalText(300),
  /** The total staff saw; a mismatch returns 409 PRICE_CHANGED. */
  expectedTotal: moneySchema,
});
export type AdminCreateOrderInput = z.input<typeof adminCreateOrderSchema>;

/** `POST /api/public/track-order`: the 6-digit tracking code of the order (SPEC §6.6b). */
export const trackOrderSchema = z.strictObject({
  code: z.string().trim().regex(TRACKING_CODE_PATTERN, 'Enter the 6-digit tracking code.'),
});
export type TrackOrderInput = z.input<typeof trackOrderSchema>;

export const orderNumberParams = z.strictObject({
  orderNumber: z.string().regex(ORDER_NUMBER_PATTERN, 'Order not found.'),
});

export const cancelOrderSchema = z.strictObject({
  reason: requiredText(3, 500, 'Reason'),
});
export type CancelOrderInput = z.input<typeof cancelOrderSchema>;

export const adminOrderStatusSchema = z.strictObject({
  to: z.enum(ORDER_STATUSES),
  note: optionalText(500),
  reason: optionalText(500),
});
export type AdminOrderStatusInput = z.input<typeof adminOrderStatusSchema>;

export const assignRiderSchema = z.strictObject({ riderId: objectIdSchema });
export type AssignRiderInput = z.input<typeof assignRiderSchema>;

export const codCollectedSchema = z.strictObject({
  amount: moneySchema,
  /** Required by the API when `amount` differs from the order total (SPEC §6.8). */
  note: optionalText(500),
});
export type CodCollectedInput = z.input<typeof codCollectedSchema>;

export const rejectReceiptSchema = z.strictObject({
  reason: requiredText(3, 500, 'Reason'),
});
export type RejectReceiptInput = z.input<typeof rejectReceiptSchema>;

export const internalNoteSchema = z.strictObject({
  internalNote: z.string().trim().max(INTERNAL_NOTE_MAX, `Use at most ${INTERNAL_NOTE_MAX} characters.`),
});
export type InternalNoteInput = z.input<typeof internalNoteSchema>;

export const receiptParams = z.strictObject({ id: objectIdSchema, receiptId: objectIdSchema });

export const customerOrderListQuery = z.strictObject({ ...pageQuery });

/** `GET /api/admin/orders` and its export (SPEC §7.3). `status` may list several (tabs). */
export const adminOrderListQuery = z.strictObject({
  ...pageQuery,
  status: csvQuery(ORDER_STATUSES.length).pipe(z.array(z.enum(ORDER_STATUSES))).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  from: dateQuery.optional(),
  to: dateQuery.optional(),
  areaId: objectIdSchema.optional(),
  riderId: objectIdSchema.optional(),
  q: z.string().trim().max(100).optional(),
  sort: sortQuery(['createdAt', 'total', 'orderNumber']).optional(),
});
export type AdminOrderListQuery = z.output<typeof adminOrderListQuery>;
