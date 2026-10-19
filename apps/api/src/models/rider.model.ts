import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, pkPhoneValidator, type Lean, TimestampedEntity } from './common.js';

/** `riders` (SPEC §5.9). Deactivated, never deleted (orders keep a snapshot). No login. */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'riders' })
export class Rider extends TimestampedEntity {
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 80 })
  name!: string;

  /** `+923XXXXXXXXX`. */
  @Prop({ type: String, required: true, validate: pkPhoneValidator })
  phone!: string;

  @Prop({ type: Boolean, required: true, default: true })
  isActive!: boolean;
}

export type RiderDocument = HydratedDocument<Rider>;
export type RiderLean = Lean<Rider>;
export const RiderSchema = SchemaFactory.createForClass(Rider);
