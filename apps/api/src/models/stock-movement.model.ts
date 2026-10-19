import { STOCK_MOVEMENT_REASONS, type StockMovementReason } from '@aricon/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type HydratedDocument, type Types } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, COUNT, integerValidator, type Lean, TimestampedEntity } from './common.js';

export const STOCK_MOVEMENT_REF_TYPES = ['order', 'import'] as const;
export type StockMovementRefType = (typeof STOCK_MOVEMENT_REF_TYPES)[number];

/**
 * `stockMovements` (SPEC §5.12, §6.10): one row for every stock change, written in the same
 * transaction as the change itself. Rows are never edited.
 */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'stockMovements' })
export class StockMovement extends TimestampedEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  variantId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, uppercase: true, maxlength: 40 })
  sku!: string;

  /** Positive when stock goes up, negative when it goes down. */
  @Prop({
    type: Number,
    required: true,
    validate: [integerValidator, { validator: (value: unknown) => value !== 0, message: "A stock change can't be 0." }],
  })
  change!: number;

  @Prop({ ...COUNT, required: true })
  stockAfter!: number;

  @Prop({ type: String, enum: STOCK_MOVEMENT_REASONS, required: true })
  reason!: StockMovementReason;

  @Prop({ type: String, enum: STOCK_MOVEMENT_REF_TYPES })
  refType?: StockMovementRefType;

  /** Order id or import job id. */
  @Prop({ type: MongooseSchema.Types.ObjectId })
  refId?: Types.ObjectId;

  @Prop({ type: String, trim: true, maxlength: 500 })
  note?: string;

  /** Staff member for ADJUST/IMPORT (and staff cancels); empty for customer orders. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  byUserId?: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  at!: Date;
}

export type StockMovementDocument = HydratedDocument<StockMovement>;
export type StockMovementLean = Lean<StockMovement>;
export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);

StockMovementSchema.index({ variantId: 1, at: -1 });
StockMovementSchema.index({ at: -1 });
StockMovementSchema.index({ reason: 1, at: -1 });
// Not in SPEC §5.12: the stock history page also filters by product and by SKU (SPEC §7.3).
StockMovementSchema.index({ productId: 1, at: -1 });
StockMovementSchema.index({ sku: 1, at: -1 });
