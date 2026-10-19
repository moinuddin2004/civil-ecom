import { z } from 'zod';
import {
  MAX_BULK_TIERS,
  MAX_DESCRIPTION_LENGTH,
  MAX_PRODUCT_IMAGES,
  MAX_RELATED_PRODUCTS,
  MAX_SPECIFICATIONS,
} from '../constants.js';
import { PRODUCT_SORTS, PRODUCT_STATUSES, UNITS } from '../enums.js';
import { validateVariantPricing } from '../pricing.js';
import {
  booleanQuery,
  clearableText,
  csvQuery,
  intQuery,
  moneySchema,
  objectIdSchema,
  optionalText,
  pageQuery,
  requiredText,
  slugSchema,
  sortQuery,
} from './common.js';

/** Products, variants, tiers and stock (SPEC §5.6, §6.1, §6.10, §7.3 "Products and stock"). */

export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, 'SKU needs at least 2 characters.')
  .max(40, 'Use at most 40 characters.')
  .regex(/^[A-Z0-9][A-Z0-9._-]*$/, 'Use letters, numbers, dots, dashes or underscores.');

export const bulkTierSchema = z.strictObject({
  minQty: z.number().int('Use a whole number.'),
  price: z.number().int('Use whole rupees.'),
});

export const variantOptionsSchema = z.strictObject({
  packSize: optionalText(60),
  grade: optionalText(60),
  colour: optionalText(60),
  size: optionalText(60),
});

const lowStockThreshold = z.number().int('Use a whole number.').min(0).max(1_000_000);

const variantFields = {
  sku: skuSchema,
  label: requiredText(1, 120, 'Label'),
  // `prefault` parses `{}` as input (Zod 4): `.default({})` must already match the transformed output.
  options: variantOptionsSchema.prefault({}),
  mrp: moneySchema,
  price: moneySchema,
  bulkTiers: z.array(bulkTierSchema).max(MAX_BULK_TIERS, `Add at most ${MAX_BULK_TIERS} bulk tiers.`).default([]),
  lowStockThreshold: lowStockThreshold.optional(),
  isActive: z.boolean().default(true),
};

/**
 * Adds §6.1 pricing issues to a schema's result. Zod still runs this after a field failed a
 * non-fatal check (a negative MRP, more than 5 tiers), so fields that already have an issue are
 * skipped instead of getting a second message.
 */
function checkPricing(
  value: { mrp: number; price: number; bulkTiers: { minQty: number; price: number }[] },
  ctx: z.RefinementCtx,
): void {
  const pathKey = (path: readonly PropertyKey[] | undefined) => (path ?? []).map(String).join('.');
  const reported = new Set(ctx.issues.map((issue) => pathKey(issue.path)));
  for (const issue of validateVariantPricing(value)) {
    if (reported.has(pathKey(issue.path))) continue;
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
}

/** A new variant. `stock` is honoured only with `products.edit_stock` (else 0). */
export const variantCreateSchema = z
  .strictObject({
    ...variantFields,
    stock: z.number().int('Use a whole number.').min(0).max(1_000_000).optional(),
  })
  .superRefine(checkPricing);
export type VariantCreateInput = z.input<typeof variantCreateSchema>;

/**
 * `PATCH /api/admin/products/:id/variants/:variantId`. Price fields need `products.edit_price`;
 * the service re-validates pricing against the merged variant. `stock` is not accepted.
 */
export const variantUpdateSchema = z.strictObject({
  sku: skuSchema.optional(),
  label: requiredText(1, 120, 'Label').optional(),
  options: variantOptionsSchema.optional(),
  mrp: moneySchema.optional(),
  price: moneySchema.optional(),
  bulkTiers: z.array(bulkTierSchema).max(MAX_BULK_TIERS).optional(),
  lowStockThreshold: lowStockThreshold.optional(),
  isActive: z.boolean().optional(),
});
export type VariantUpdateInput = z.input<typeof variantUpdateSchema>;

export const PRICE_FIELDS = ['mrp', 'price', 'bulkTiers'] as const;

export const specificationSchema = z.strictObject({
  label: requiredText(1, 60, 'Label'),
  value: requiredText(1, 200, 'Value'),
});

/** Product image prefix `products/{productId}/{imageId}` returned by the upload endpoint. */
export const productImageKeySchema = z
  .string()
  .regex(/^products\/[a-f\d]{24}\/[a-f\d]{24}$/, 'Upload the image again.');

export const productImageSchema = z.strictObject({
  key: productImageKeySchema,
  alt: z.string().trim().max(150).default(''),
});

export const seoSchema = z.strictObject({
  title: optionalText(70),
  description: optionalText(160),
});

const uniqueIds = (ids: string[]) => new Set(ids).size === ids.length;

const productDetailFields = {
  name: requiredText(3, 150, 'Name'),
  slug: slugSchema.optional(),
  brandId: objectIdSchema,
  categoryId: objectIdSchema,
  type: optionalText(60),
  unit: z.enum(UNITS),
  description: z.string().max(MAX_DESCRIPTION_LENGTH, 'Description is too long.').default(''),
  specifications: z.array(specificationSchema).max(MAX_SPECIFICATIONS).default([]),
  images: z.array(productImageSchema).max(MAX_PRODUCT_IMAGES, `Add at most ${MAX_PRODUCT_IMAGES} images.`).default([]),
  isFeatured: z.boolean().default(false),
  relatedProductIds: z
    .array(objectIdSchema)
    .max(MAX_RELATED_PRODUCTS)
    .refine(uniqueIds, 'Each related product can be added once.')
    .default([]),
  seo: seoSchema.prefault({}),
};

/**
 * `POST /api/admin/products`. `id` lets the form use the id that image uploads for this new
 * product were stored under (the upload endpoint returns it).
 */
export const productCreateSchema = z
  .strictObject({
    id: objectIdSchema.optional(),
    ...productDetailFields,
    status: z.enum(['active', 'hidden']).default('hidden'),
    variants: z.array(variantCreateSchema).min(1, 'Add at least one variant.').max(50),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.variants.forEach((variant, index) => {
      if (seen.has(variant.sku)) {
        ctx.addIssue({ code: 'custom', path: ['variants', index, 'sku'], message: 'Each SKU must be unique.' });
      }
      seen.add(variant.sku);
    });
  });
export type ProductCreateInput = z.input<typeof productCreateSchema>;
export type ProductCreateData = z.output<typeof productCreateSchema>;

/**
 * `PATCH /api/admin/products/:id`: details plus per-variant label/option/price changes.
 * Status has its own endpoint; `stock` is rejected (unknown key).
 */
export const productUpdateSchema = z.strictObject({
  name: requiredText(3, 150, 'Name').optional(),
  slug: slugSchema.optional(),
  brandId: objectIdSchema.optional(),
  categoryId: objectIdSchema.optional(),
  type: clearableText(60).optional(),
  unit: z.enum(UNITS).optional(),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
  specifications: z.array(specificationSchema).max(MAX_SPECIFICATIONS).optional(),
  images: z.array(productImageSchema).max(MAX_PRODUCT_IMAGES).optional(),
  isFeatured: z.boolean().optional(),
  relatedProductIds: z.array(objectIdSchema).max(MAX_RELATED_PRODUCTS).refine(uniqueIds).optional(),
  seo: seoSchema.optional(),
  variants: z
    .array(variantUpdateSchema.extend({ id: objectIdSchema }))
    .max(50)
    .optional(),
});
export type ProductUpdateInput = z.input<typeof productUpdateSchema>;

export const productStatusSchema = z.strictObject({ status: z.enum(PRODUCT_STATUSES) });
export type ProductStatusInput = z.input<typeof productStatusSchema>;

export const stockAdjustmentSchema = z.strictObject({
  variantId: objectIdSchema,
  change: z
    .number()
    .int('Use a whole number.')
    .min(-1_000_000)
    .max(1_000_000)
    .refine((value) => value !== 0, 'Enter a change other than 0.'),
  reason: requiredText(3, 300, 'Reason'),
});
export type StockAdjustmentInput = z.input<typeof stockAdjustmentSchema>;

/** `GET /api/products` (SPEC §7.2). List filters take comma-separated values. */
export const productListQuery = z.strictObject({
  ...pageQuery,
  category: slugSchema.optional(),
  brand: csvQuery(30).optional(),
  q: z.string().trim().max(100).optional(),
  minPrice: intQuery.optional(),
  maxPrice: intQuery.optional(),
  type: csvQuery().optional(),
  packSize: csvQuery().optional(),
  grade: csvQuery().optional(),
  colour: csvQuery().optional(),
  size: csvQuery().optional(),
  inStock: booleanQuery.optional(),
  sort: z.enum(PRODUCT_SORTS).optional(),
});
export type ProductListQuery = z.output<typeof productListQuery>;

export const adminProductListQuery = z.strictObject({
  ...pageQuery,
  q: z.string().trim().max(100).optional(),
  categoryId: objectIdSchema.optional(),
  brandId: objectIdSchema.optional(),
  status: z.enum([...PRODUCT_STATUSES, 'all']).optional(),
  lowStock: booleanQuery.optional(),
  sort: sortQuery(['updatedAt', 'createdAt', 'name', 'minPrice', 'totalStock']).optional(),
});
export type AdminProductListQuery = z.output<typeof adminProductListQuery>;
