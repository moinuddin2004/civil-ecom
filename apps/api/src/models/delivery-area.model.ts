import { DEFAULT_CITY } from '@aricon/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, MONEY, SORT_ORDER, type Lean, TimestampedEntity } from './common.js';

/** `deliveryAreas` (SPEC §5.8). The delivery fee rules are `getDeliveryFee()` in shared (§6.4). */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'deliveryAreas' })
export class DeliveryArea extends TimestampedEntity {
  /** e.g. "Gulshan-e-Iqbal"; unique per city. */
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 80 })
  name!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 60, default: DEFAULT_CITY })
  city!: string;

  /** False = shown as "Not delivering yet"; used instead of deleting an area that is in use. */
  @Prop({ type: Boolean, required: true, default: true })
  isServiceable!: boolean;

  /** null → `settings.defaultDeliveryFee`. */
  @Prop({ ...MONEY, default: null })
  deliveryFee!: number | null;

  /** null → no free delivery. */
  @Prop({ ...MONEY, default: null })
  freeDeliveryAbove!: number | null;

  @Prop(SORT_ORDER)
  sortOrder!: number;
}

export type DeliveryAreaDocument = HydratedDocument<DeliveryArea>;
export type DeliveryAreaLean = Lean<DeliveryArea>;
export const DeliveryAreaSchema = SchemaFactory.createForClass(DeliveryArea);

DeliveryAreaSchema.index({ city: 1, name: 1 }, { unique: true });
