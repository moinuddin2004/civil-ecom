import { CART_MAX_LINES, QTY_MAX, QTY_MIN } from '@aricon/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type HydratedDocument, type Types } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, integerValidator, maxItems, type Lean, TimestampedEntity } from './common.js';

/** One cart line (no `_id`: a line is identified by its variant). */
@Schema({ _id: false, strict: true })
export class CartItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  variantId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: QTY_MIN, max: QTY_MAX, validate: integerValidator })
  qty!: number;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);

/**
 * `carts` (SPEC §5.7): one per signed-in customer. Prices are never stored; they are computed on
 * every read with `computeCart()` from shared.
 */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'carts' })
export class Cart extends TimestampedEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({
    type: [CartItemSchema],
    default: [],
    validate: maxItems(CART_MAX_LINES, `A cart can hold at most ${CART_MAX_LINES} different items.`),
  })
  items!: CartItem[];
}

export type CartDocument = HydratedDocument<Cart>;
export type CartLean = Lean<Cart>;
export const CartSchema = SchemaFactory.createForClass(Cart);

CartSchema.index({ userId: 1 }, { unique: true });
