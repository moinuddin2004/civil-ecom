import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  MAX_BULK_TIERS,
  MAX_DESCRIPTION_LENGTH,
  MAX_PRODUCT_IMAGES,
  MAX_RELATED_PRODUCTS,
  MAX_SPECIFICATIONS,
  MIN_TIER_QTY,
  PRODUCT_STATUSES,
  UNITS,
  VARIANT_OPTION_KEYS,
  validateVariantPricing,
  type FilterKey,
  type ProductStatus,
  type Unit,
  type VariantOptionKey,
} from '@aricon/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Schema as MongooseSchema, Types, type ClientSession, type HydratedDocument, type Model } from 'mongoose';
import type { BrandLean } from './brand.model.js';
import type { CategoryLean } from './category.model.js';
import { BASE_SCHEMA_OPTIONS, COUNT, integerValidator, maxItems, MONEY, SLUG, type Lean, TimestampedEntity } from './common.js';

/*
 * `products` (SPEC §5.6) with embedded variants. `filters`, `minPrice`, `maxPrice`, `totalStock`,
 * `categoryPath` and `brandName` are derived: a pre-validate hook fills them on every save.
 *
 * Stock is changed with `updateOne($inc + arrayFilters)` (order placement, restock), which skips the
 * hooks, so those writes must call `recomputeProductStock()` in the same session afterwards. Change
 * variants in place (`product.variants.id(id).price = …`); never assign the whole `variants` array,
 * which would write back stock values that may be stale.
 */

const VALUE = { _id: false, strict: true } as const;
const optionValue = { type: String, trim: true, maxlength: 60 };

@Schema(VALUE)
export class VariantOptions {
  @Prop(optionValue) packSize?: string;
  @Prop(optionValue) grade?: string;
  @Prop(optionValue) colour?: string;
  @Prop(optionValue) size?: string;
}

@Schema(VALUE)
export class BulkTier {
  @Prop({ type: Number, required: true, min: MIN_TIER_QTY, validate: integerValidator })
  minQty!: number;

  @Prop({ ...MONEY, required: true })
  price!: number;
}

// `minimize: false`: keep an empty `options` object (a variant without options) instead of dropping the
// field — the product's own setting doesn't reach embedded schemas.
@Schema({ strict: true, minimize: false })
export class Variant {
  _id!: Types.ObjectId;

  /** Uppercase; unique across all products. */
  @Prop({ type: String, required: true, trim: true, uppercase: true, minlength: 2, maxlength: 40 })
  sku!: string;

  /** e.g. "50 kg bag, OPC 53". */
  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  label!: string;

  @Prop({ type: SchemaFactory.createForClass(VariantOptions), default: () => ({}) })
  options!: Partial<Record<VariantOptionKey, string>>;

  @Prop({ ...MONEY, required: true })
  mrp!: number;

  @Prop({ ...MONEY, required: true })
  price!: number;

  @Prop({
    type: [SchemaFactory.createForClass(BulkTier)],
    default: [],
    validate: maxItems(MAX_BULK_TIERS, `Add at most ${MAX_BULK_TIERS} bulk tiers.`),
  })
  bulkTiers!: BulkTier[];

  /** Never negative. Changed only through the stock paths in SPEC §6.10. */
  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: [0, "Stock can't go below 0."],
    validate: { validator: Number.isInteger, message: 'Stock must be a whole number.' },
  })
  stock!: number;

  @Prop({ ...COUNT, required: true, default: DEFAULT_LOW_STOCK_THRESHOLD, max: 1_000_000 })
  lowStockThreshold!: number;

  /** Inactive variants are hidden in the store. */
  @Prop({ type: Boolean, required: true, default: true })
  isActive!: boolean;
}

@Schema({ strict: true })
export class ProductImage {
  _id!: Types.ObjectId;

  /** Image prefix `products/{productId}/{imageId}` (three widths are stored under it). */
  @Prop({ type: String, required: true, trim: true, maxlength: 300 })
  key!: string;

  @Prop({ type: String, trim: true, maxlength: 150, default: '' })
  alt!: string;
}

@Schema(VALUE)
export class Specification {
  @Prop({ type: String, required: true, trim: true, maxlength: 60 })
  label!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  value!: string;
}

/** Storefront filter values, computed from the product type and the active variants' options. */
@Schema(VALUE)
export class ProductFilters implements Record<FilterKey, string[]> {
  @Prop({ type: [String], default: [] }) type!: string[];
  @Prop({ type: [String], default: [] }) packSize!: string[];
  @Prop({ type: [String], default: [] }) grade!: string[];
  @Prop({ type: [String], default: [] }) colour!: string[];
  @Prop({ type: [String], default: [] }) size!: string[];
}

@Schema(VALUE)
export class ProductSeo {
  @Prop({ type: String, trim: true, maxlength: 70 }) title?: string;
  @Prop({ type: String, trim: true, maxlength: 160 }) description?: string;
}

/** A unique index can't stop duplicates inside one document's array, so check that here. */
const variantsValidators = [
  {
    validator: (variants: unknown) => Array.isArray(variants) && variants.length > 0,
    message: 'Add at least one variant.',
  },
  maxItems(50, 'Add at most 50 variants.'),
  {
    validator: (variants: unknown) => {
      if (!Array.isArray(variants)) return true;
      const skus = (variants as { sku?: string }[]).map((variant) => variant.sku);
      return new Set(skus).size === skus.length;
    },
    message: 'Each SKU must be unique.',
  },
];

// `minimize: false` keeps empty `options`/`seo` objects, so lean reads always have them.
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'products', minimize: false })
export class Product extends TimestampedEntity {
  @Prop({ type: String, required: true, trim: true, minlength: 3, maxlength: 150 })
  name!: string;

  @Prop(SLUG)
  slug!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Brand', required: true })
  brandId!: Types.ObjectId;

  /** Copied from the brand (filled on save when `brandId` changes; brand renames update it). */
  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  brandName!: string;

  /** A leaf or top-level category. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category', required: true })
  categoryId!: Types.ObjectId;

  /** `[parentId, categoryId]` or `[categoryId]`; computed on save. */
  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Category' }], default: [] })
  categoryPath!: Types.ObjectId[];

  /** e.g. "Emulsion", "PPC"; a storefront filter. */
  @Prop({ type: String, trim: true, maxlength: 60 })
  type?: string;

  @Prop({ type: String, enum: UNITS, required: true })
  unit!: Unit;

  /** Markdown. */
  @Prop({ type: String, default: '', maxlength: MAX_DESCRIPTION_LENGTH })
  description!: string;

  @Prop({
    type: [SchemaFactory.createForClass(Specification)],
    default: [],
    validate: maxItems(MAX_SPECIFICATIONS, `Add at most ${MAX_SPECIFICATIONS} specification rows.`),
  })
  specifications!: Specification[];

  /** Ordered; the first is the main image. */
  @Prop({
    type: [SchemaFactory.createForClass(ProductImage)],
    default: [],
    validate: maxItems(MAX_PRODUCT_IMAGES, `Add at most ${MAX_PRODUCT_IMAGES} images.`),
  })
  images!: ProductImage[];

  @Prop({ type: [SchemaFactory.createForClass(Variant)], validate: variantsValidators })
  variants!: Variant[];

  @Prop({ type: SchemaFactory.createForClass(ProductFilters), default: () => ({}) })
  filters!: ProductFilters;

  /** Lowest / highest active variant price; 0 when no variant is active. */
  @Prop({ ...MONEY, required: true, default: 0 })
  minPrice!: number;

  @Prop({ ...MONEY, required: true, default: 0 })
  maxPrice!: number;

  /** Sum of active variants' stock. */
  @Prop({ ...COUNT, required: true, default: 0 })
  totalStock!: number;

  @Prop({ type: Boolean, required: true, default: false })
  isFeatured!: boolean;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Product' }],
    default: [],
    validate: maxItems(MAX_RELATED_PRODUCTS, `Add at most ${MAX_RELATED_PRODUCTS} related products.`),
  })
  relatedProductIds!: Types.ObjectId[];

  @Prop({ type: SchemaFactory.createForClass(ProductSeo), default: () => ({}) })
  seo!: ProductSeo;

  /** Only `active` is visible in the store. */
  @Prop({ type: String, enum: PRODUCT_STATUSES, required: true, default: 'hidden' })
  status!: ProductStatus;
}

export type ProductDocument = HydratedDocument<Product>;
export type ProductLean = Lean<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);

/* Derived fields */

export interface DerivedVariantInput {
  options?: Partial<Record<VariantOptionKey, string>> | null;
  price: number;
  stock: number;
  isActive: boolean;
}

export interface ProductDerived {
  filters: Record<FilterKey, string[]>;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
}

// Natural order, so "5 kg" sorts before "20 kg".
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function distinctSorted(values: Iterable<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) set.add(trimmed);
  }
  return [...set].sort(collator.compare);
}

/**
 * Filters, price range and total stock of a product (SPEC §5.6), from its **active** variants.
 * `filters.type` is the product's own `type`; the option filters are the distinct, naturally sorted
 * option values. With no active variant, prices and stock are 0.
 */
export function computeProductDerived(variants: readonly DerivedVariantInput[], type?: string | null): ProductDerived {
  const active = variants.filter((variant) => variant.isActive);
  const productType = type?.trim();
  const filters: Record<FilterKey, string[]> = {
    type: productType ? [productType] : [],
    packSize: [],
    grade: [],
    colour: [],
    size: [],
  };
  for (const key of VARIANT_OPTION_KEYS) {
    filters[key] = distinctSorted(active.map((variant) => variant.options?.[key]));
  }
  const prices = active.map((variant) => variant.price);
  return {
    filters,
    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
    maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
    totalStock: active.reduce((sum, variant) => sum + variant.stock, 0),
  };
}

/** Aggregation expression: `field` of every active variant, as an array. */
function activeVariantValues(field: 'stock' | 'price') {
  return {
    $map: {
      input: { $filter: { input: '$variants', as: 'v', cond: { $eq: ['$$v.isActive', true] } } },
      as: 'v',
      in: `$$v.${field}`,
    },
  };
}

/**
 * Recomputes `totalStock`, `minPrice` and `maxPrice` from the stored variants, in the database.
 * Call it (in the same session/transaction) after changing variant stock with `updateOne`/`$inc`,
 * which skips the save hooks. Does not touch `updatedAt`: a sale is not a product edit.
 */
export async function recomputeProductStock(
  model: Model<Product>,
  productIds: readonly (Types.ObjectId | string)[],
  session?: ClientSession | null,
): Promise<void> {
  const ids = [...new Set(productIds.map(String))].map((id) => new Types.ObjectId(id));
  if (ids.length === 0) return;
  await model.updateMany(
    { _id: mongoose.trusted({ $in: ids }) },
    [
      {
        $set: {
          totalStock: { $sum: activeVariantValues('stock') },
          minPrice: { $ifNull: [{ $min: activeVariantValues('price') }, 0] },
          maxPrice: { $ifNull: [{ $max: activeVariantValues('price') }, 0] },
        },
      },
    ],
    { session: session ?? undefined, updatePipeline: true, timestamps: false },
  );
}

/* Hooks */

/** `$locals` flag: the save changed variants of an existing product (see the post-save hook). */
const RECOMPUTE_AFTER_SAVE = 'recomputeStockAfterSave';

ProductSchema.pre('validate', async function () {
  // Derived values first, so the validators below see them.
  this.set(computeProductDerived(this.variants, this.type));

  // Pricing and tier rules (SPEC §6.1), with the same messages as the web forms.
  this.variants.forEach((variant, index) => {
    for (const issue of validateVariantPricing(variant)) {
      this.invalidate(['variants', index, ...issue.path].join('.'), issue.message);
    }
  });

  const session = this.$session();

  if (this.categoryId && (this.isNew || this.isModified('categoryId') || this.categoryPath.length === 0)) {
    const category = await this.$model('Category')
      .findById(this.categoryId, { parentId: 1 })
      .session(session)
      .lean<Pick<CategoryLean, '_id' | 'parentId'>>();
    if (category) this.categoryPath = category.parentId ? [category.parentId, category._id] : [category._id];
    else this.invalidate('categoryId', 'Choose a category that exists.');
  }

  if (this.brandId && (this.isNew || this.isModified('brandId') || !this.brandName)) {
    const brand = await this.$model('Brand')
      .findById(this.brandId, { name: 1 })
      .session(session)
      .lean<Pick<BrandLean, 'name'>>();
    if (brand) this.brandName = brand.name;
    else this.invalidate('brandId', 'Choose a brand that exists.');
  }
});

ProductSchema.pre('save', function () {
  this.$locals[RECOMPUTE_AFTER_SAVE] = !this.isNew && this.isModified('variants');
});

// The pre-validate hook computed `totalStock` from the stock values loaded with the document; an
// order may have changed stock since. Recompute from the stored values so the total stays exact.
ProductSchema.post('save', async function () {
  if (this.$locals[RECOMPUTE_AFTER_SAVE] !== true) return;
  this.$locals[RECOMPUTE_AFTER_SAVE] = false;
  await recomputeProductStock(this.constructor as Model<Product>, [this._id], this.$session());
});

ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ 'variants.sku': 1 }, { unique: true });
// Not in SPEC §5.6: `PUT /api/cart/items` only sends a variant id and needs its product.
ProductSchema.index({ 'variants._id': 1 });
ProductSchema.index({ status: 1, categoryPath: 1, minPrice: 1 });
ProductSchema.index({ status: 1, brandId: 1 });
ProductSchema.index({ status: 1, createdAt: -1 });
ProductSchema.index({ isFeatured: 1, status: 1 });
ProductSchema.index({ name: 'text', brandName: 'text' }, { weights: { name: 10, brandName: 5 }, name: 'product_text_search' });
