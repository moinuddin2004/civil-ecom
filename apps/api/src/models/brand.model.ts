import { CATALOG_STATUSES, type CatalogStatus } from '@aricon/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, SLUG, SORT_ORDER, type Lean, TimestampedEntity } from './common.js';

/** `brands` (SPEC §5.5). Renaming a brand must also update `products.brandName`. */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'brands' })
export class Brand extends TimestampedEntity {
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 80 })
  name!: string;

  @Prop(SLUG)
  slug!: string;

  /** Public storage key, e.g. `brands/{id}/logo.webp`. */
  @Prop({ type: String, trim: true, maxlength: 300 })
  logoKey?: string;

  @Prop({ type: String, enum: CATALOG_STATUSES, required: true, default: 'active' })
  status!: CatalogStatus;

  @Prop(SORT_ORDER)
  sortOrder!: number;
}

export type BrandDocument = HydratedDocument<Brand>;
export type BrandLean = Lean<Brand>;
export const BrandSchema = SchemaFactory.createForClass(Brand);

BrandSchema.index({ slug: 1 }, { unique: true });
