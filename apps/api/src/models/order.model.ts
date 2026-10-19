import {
  ACTOR_TYPES,
  CART_MAX_LINES,
  CUSTOMER_NOTE_MAX,
  DEFAULT_CITY,
  INTERNAL_NOTE_MAX,
  lineTotal,
  ORDER_NUMBER_PATTERN,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  QTY_MAX,
  QTY_MIN,
  RECEIPT_MIME_TYPES,
  RECEIPT_STATUSES,
  RECEIPT_UPLOAD_MAX_BYTES,
  UNITS,
  type ActorType,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type ReceiptStatus,
  type Unit,
} from '@aricon/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type HydratedDocument, type Types } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, integerValidator, maxItems, MONEY, pkPhoneValidator, type Lean, TimestampedEntity } from './common.js';

/*
 * `orders` (SPEC §5.10). Customer, address, product and rider data are **snapshots** taken when the
 * order is placed (or the rider assigned) and never updated afterwards. `statusHistory` is
 * append-only. Status changes follow the table in shared `order-status.ts`.
 */

const VALUE = { _id: false, strict: true } as const;
const text = (max: number, required = true) => ({ type: String, required, trim: true, maxlength: max });
const PHONE = { type: String, required: true, validate: pkPhoneValidator };

@Schema(VALUE)
export class OrderUserSnapshot {
  @Prop(text(80)) name!: string;
  @Prop({ type: String, required: true, trim: true, lowercase: true, maxlength: 254 }) email!: string;
  @Prop(PHONE) phone!: string;
}

@Schema(VALUE)
export class ShippingAddress {
  @Prop(text(60)) label!: string;
  @Prop(text(80)) contactName!: string;
  @Prop(PHONE) phone!: string;
  @Prop(text(200)) line1!: string;
  @Prop(text(200, false)) line2?: string;
  @Prop(text(200, false)) landmark?: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'DeliveryArea', required: true }) areaId!: Types.ObjectId;
  @Prop(text(80)) areaName!: string;
  @Prop({ ...text(60), default: DEFAULT_CITY }) city!: string;
}

@Schema(VALUE)
export class OrderItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true }) productId!: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true }) variantId!: Types.ObjectId;
  @Prop(text(40)) sku!: string;
  @Prop(text(150)) productName!: string;
  @Prop(text(120)) variantLabel!: string;
  @Prop(text(80)) brandName!: string;
  @Prop({ type: String, enum: UNITS, required: true }) unit!: Unit;
  /** Product image prefix, when the product had an image. */
  @Prop(text(300, false)) imageKey?: string;
  @Prop({ type: Number, required: true, min: QTY_MIN, max: QTY_MAX, validate: integerValidator }) qty!: number;
  @Prop({ ...MONEY, required: true }) mrp!: number;
  /** The variant price before bulk tiers. */
  @Prop({ ...MONEY, required: true }) basePrice!: number;
  /** Price per unit after the bulk tier. */
  @Prop({ ...MONEY, required: true }) unitPrice!: number;
  /** `minQty` of the tier that applied; null when the base price applied. */
  @Prop({ type: Number, min: 2, validate: integerValidator, default: null }) appliedTierMinQty!: number | null;
  /** `unitPrice × qty`. */
  @Prop({ ...MONEY, required: true }) lineTotal!: number;
}

@Schema({ strict: true })
export class Receipt {
  _id!: Types.ObjectId;
  /** Private storage key `receipts/{orderId}/{receiptId}.{ext}`. */
  @Prop(text(300)) key!: string;
  @Prop({ type: String, enum: RECEIPT_MIME_TYPES, required: true }) mimeType!: (typeof RECEIPT_MIME_TYPES)[number];
  @Prop({ type: Number, required: true, min: 1, max: RECEIPT_UPLOAD_MAX_BYTES, validate: integerValidator }) sizeBytes!: number;
  @Prop({ type: Date, required: true, default: Date.now }) uploadedAt!: Date;
  @Prop({ type: String, enum: RECEIPT_STATUSES, required: true, default: 'pending' }) status!: ReceiptStatus;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) reviewedByUserId?: Types.ObjectId;
  @Prop({ type: Date }) reviewedAt?: Date;
  @Prop(text(500, false)) rejectReason?: string;
}

@Schema(VALUE)
export class StatusHistoryEntry {
  @Prop({ type: String, enum: ORDER_STATUSES, required: true }) status!: OrderStatus;
  @Prop({ type: Date, required: true, default: Date.now }) at!: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) byUserId?: Types.ObjectId;
  @Prop({ type: String, enum: ACTOR_TYPES, required: true }) byType!: ActorType;
  @Prop(text(500, false)) note?: string;
}

@Schema(VALUE)
export class OrderRiderSnapshot {
  @Prop(text(80)) name!: string;
  @Prop(PHONE) phone!: string;
}

@Schema(VALUE)
export class CodCollected {
  @Prop({ ...MONEY, required: true }) amount!: number;
  @Prop({ type: Date, required: true, default: Date.now }) at!: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) byUserId!: Types.ObjectId;
}

@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'orders' })
export class Order extends TimestampedEntity {
  /** `ARC-{YYYY}-{000123}` (SPEC §6.9). */
  @Prop({ type: String, required: true, match: ORDER_NUMBER_PATTERN })
  orderNumber!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: SchemaFactory.createForClass(OrderUserSnapshot), required: true })
  user!: OrderUserSnapshot;

  @Prop({ type: SchemaFactory.createForClass(ShippingAddress), required: true })
  shippingAddress!: ShippingAddress;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'DeliveryArea', required: true })
  deliveryAreaId!: Types.ObjectId;

  @Prop({
    type: [SchemaFactory.createForClass(OrderItem)],
    validate: [
      {
        validator: (items: unknown) => Array.isArray(items) && items.length > 0,
        message: 'An order needs at least one item.',
      },
      maxItems(CART_MAX_LINES, `An order can have at most ${CART_MAX_LINES} lines.`),
    ],
  })
  items!: OrderItem[];

  /** Sum of `lineTotal`. */
  @Prop({ ...MONEY, required: true }) subtotal!: number;
  @Prop({ ...MONEY, required: true }) deliveryFee!: number;
  /** `subtotal + deliveryFee`. */
  @Prop({ ...MONEY, required: true }) total!: number;

  @Prop({ type: String, enum: PAYMENT_METHODS, required: true }) paymentMethod!: PaymentMethod;
  @Prop({ type: String, enum: PAYMENT_STATUSES, required: true, default: 'PENDING' }) paymentStatus!: PaymentStatus;

  /** Bank transfer only. */
  @Prop({ type: [SchemaFactory.createForClass(Receipt)], default: [] })
  receipts!: Receipt[];

  @Prop({ type: String, enum: ORDER_STATUSES, required: true, default: 'NEW' }) status!: OrderStatus;

  @Prop({ type: [SchemaFactory.createForClass(StatusHistoryEntry)], default: [] })
  statusHistory!: StatusHistoryEntry[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Rider' }) riderId?: Types.ObjectId;
  /** Snapshot taken when the rider is assigned. */
  @Prop({ type: SchemaFactory.createForClass(OrderRiderSnapshot) }) rider?: OrderRiderSnapshot;
  @Prop({ type: SchemaFactory.createForClass(CodCollected) }) codCollected?: CodCollected;

  @Prop(text(CUSTOMER_NOTE_MAX, false)) customerNote?: string;
  /** Staff only. */
  @Prop(text(INTERNAL_NOTE_MAX, false)) internalNote?: string;
  @Prop(text(500, false)) cancelReason?: string;

  /** From the checkout `Idempotency-Key` header; unique per user. */
  @Prop(text(100)) idempotencyKey!: string;
}

export type OrderDocument = HydratedDocument<Order>;
export type OrderLean = Lean<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);

// Totals must add up (SPEC §6.2). The service computes them with the shared pricing functions;
// this catches any mismatch before it is stored.
OrderSchema.pre('validate', function () {
  let subtotal = 0;
  this.items.forEach((item, index) => {
    if (item.lineTotal !== lineTotal(item.unitPrice, item.qty)) {
      this.invalidate(`items.${index}.lineTotal`, 'Line total must equal unit price × quantity.');
    }
    subtotal += item.lineTotal;
  });
  if (this.subtotal !== subtotal) this.invalidate('subtotal', 'Subtotal must equal the sum of the line totals.');
  if (this.total !== this.subtotal + this.deliveryFee) this.invalidate('total', 'Total must equal subtotal plus delivery fee.');
});

OrderSchema.index({ orderNumber: 1 }, { unique: true });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ riderId: 1, status: 1 });
OrderSchema.index({ 'user.phone': 1 });
// Not in SPEC §5.10: the unfiltered admin list (newest first) and the date-range reports.
OrderSchema.index({ createdAt: -1 });
