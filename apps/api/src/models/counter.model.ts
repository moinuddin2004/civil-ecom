import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, COUNT, TimestampedEntity } from './common.js';

/**
 * `counters` (SPEC §5.11): named sequences, e.g. `{ _id: 'order-2026', seq: 123 }` for yearly order
 * numbers (`orderNumberContext()` from shared gives the id). Incremented inside the order
 * transaction so an aborted order doesn't use up a number.
 */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'counters' })
export class Counter extends TimestampedEntity {
  @Prop({ type: String, required: true, trim: true, maxlength: 60 })
  _id!: string;

  @Prop({ ...COUNT, required: true, default: 0 })
  seq!: number;
}

export type CounterDocument = HydratedDocument<Counter>;
export const CounterSchema = SchemaFactory.createForClass(Counter);
