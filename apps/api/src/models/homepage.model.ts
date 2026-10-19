import { MAX_BANNERS, MAX_HOMEPAGE_PRODUCTS } from '@aricon/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type HydratedDocument, type Types } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, maxItems, SORT_ORDER, type Lean, TimestampedEntity } from './common.js';

export const HOMEPAGE_ID = 'home';

@Schema({ strict: true })
export class Banner {
  _id!: Types.ObjectId;

  /** Public key `banners/{bannerId}/desktop.webp`. */
  @Prop({ type: String, required: true, trim: true, maxlength: 300 })
  desktopKey!: string;

  @Prop({ type: String, trim: true, maxlength: 300, default: null })
  mobileKey!: string | null;

  @Prop({ type: String, required: true, trim: true, maxlength: 150 })
  alt!: string;

  /** Site path (`/category/cement`) or an https URL. */
  @Prop({ type: String, trim: true, maxlength: 500, default: null })
  link!: string | null;

  @Prop({ type: Boolean, required: true, default: true })
  isActive!: boolean;

  @Prop(SORT_ORDER)
  sortOrder!: number;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);

const productIdList = {
  type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Product' }],
  default: [],
  validate: maxItems(MAX_HOMEPAGE_PRODUCTS, `Pick at most ${MAX_HOMEPAGE_PRODUCTS} products.`),
};

/**
 * `homepage` (SPEC §5.13): a single document with `_id: 'home'`. Category tiles come from
 * `categories.showOnHome`; new arrivals are the latest active products.
 */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'homepage' })
export class Homepage extends TimestampedEntity {
  @Prop({ type: String, enum: [HOMEPAGE_ID], default: HOMEPAGE_ID })
  _id!: typeof HOMEPAGE_ID;

  @Prop({ type: [BannerSchema], default: [], validate: maxItems(MAX_BANNERS, `Add at most ${MAX_BANNERS} banners.`) })
  banners!: Banner[];

  @Prop(productIdList)
  featuredProductIds!: Types.ObjectId[];

  @Prop(productIdList)
  dealProductIds!: Types.ObjectId[];
}

export type HomepageDocument = HydratedDocument<Homepage>;
export type HomepageLean = Lean<Homepage>;
export const HomepageSchema = SchemaFactory.createForClass(Homepage);
