import { CATALOG_STATUSES, type CatalogStatus } from '@aricon/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, type HydratedDocument, type Model, type Types } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, SLUG, SORT_ORDER, type Lean, TimestampedEntity } from './common.js';

/** `categories` (SPEC §5.4): at most two levels (top level and one level of sub-categories). */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'categories' })
export class Category extends TimestampedEntity {
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 80 })
  name!: string;

  @Prop(SLUG)
  slug!: string;

  /** null = top level. */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Category',
    default: null,
    validate: {
      // Max depth 2: the parent must exist, be top level and not be the category itself. Services
      // check this too (with a friendlier 409); this guards direct writes.
      validator: async function (this: unknown, parentId: Types.ObjectId | null): Promise<boolean> {
        if (!parentId || !(this instanceof Document)) return true;
        if (parentId.equals(this._id as Types.ObjectId)) return false;
        const model = this.constructor as Model<Category>;
        const parent = await model.exists({ _id: parentId, parentId: null }).session(this.$session());
        return parent !== null;
      },
      message: 'Choose a top-level category as the parent.',
    },
  })
  parentId!: Types.ObjectId | null;

  /** Shown on the category page and used for SEO. */
  @Prop({ type: String, trim: true, maxlength: 2_000 })
  description?: string;

  /** Public storage key, e.g. `categories/{id}/image.webp`. */
  @Prop({ type: String, trim: true, maxlength: 300 })
  imageKey?: string;

  @Prop(SORT_ORDER)
  sortOrder!: number;

  /** Category tiles on the home page. */
  @Prop({ type: Boolean, required: true, default: false })
  showOnHome!: boolean;

  @Prop({ type: String, enum: CATALOG_STATUSES, required: true, default: 'active' })
  status!: CatalogStatus;
}

export type CategoryDocument = HydratedDocument<Category>;
export type CategoryLean = Lean<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ parentId: 1, sortOrder: 1 });
