import {
  MAX_BULK_TIERS,
  MAX_DESCRIPTION_LENGTH,
  MAX_PRODUCT_IMAGES,
  MAX_SPECIFICATIONS,
  bulkTierSchema,
  moneySchema,
  optionalText,
  requiredText,
  seoSchema,
  skuSchema,
  specificationSchema,
  UNITS,
  validateVariantPricing,
  variantOptionsSchema,
  type AdminProductDTO,
} from '@aricon/shared';
import { z } from 'zod';
import { optionalSlugSchema } from './optional-slug-schema';

/**
 * The product editor's form (SPEC §5.6, §10.5): the shared product rules (SKU shape, text limits,
 * `validateVariantPricing`) in one shape for both "Add product" and "Edit product". On save it is
 * split into the API's requests: `POST /admin/products`, or `PATCH` for details and existing
 * variants, `POST …/variants` for new rows and `POST …/status` for a status change.
 */

export const productFormVariantSchema = z
  .strictObject({
    /** Present for a saved variant; absent for a row added in the form. */
    id: z.string().optional(),
    sku: skuSchema,
    label: requiredText(1, 120, 'Label'),
    // `prefault` parses `{}` as input (Zod 4); `.default({})` would have to match the transformed output.
    options: variantOptionsSchema.prefault({}),
    mrp: moneySchema,
    price: moneySchema,
    bulkTiers: z.array(bulkTierSchema).max(MAX_BULK_TIERS, `Add at most ${MAX_BULK_TIERS} bulk tiers.`).default([]),
    /** Saved variants: shown only (changed through "Adjust stock"). New rows: the opening stock. */
    stock: z.number().int('Use a whole number.').min(0).max(1_000_000).default(0),
    lowStockThreshold: z.number().int('Use a whole number.').min(0).max(1_000_000).default(5),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    for (const issue of validateVariantPricing(value)) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });
export type ProductFormVariantInput = z.input<typeof productFormVariantSchema>;
export type ProductFormVariantData = z.output<typeof productFormVariantSchema>;

export const productFormSchema = z
  .strictObject({
    name: requiredText(3, 150, 'Name'),
    slug: optionalSlugSchema,
    brandId: z.string().min(1, 'Choose a brand.'),
    categoryId: z.string().min(1, 'Choose a category.'),
    type: optionalText(60),
    unit: z.enum(UNITS),
    status: z.enum(['active', 'hidden', 'archived']).default('hidden'),
    description: z.string().max(MAX_DESCRIPTION_LENGTH, 'Description is too long.').default(''),
    specifications: z.array(specificationSchema).max(MAX_SPECIFICATIONS).default([]),
    seo: seoSchema.prefault({}),
    /** Uploaded photos (storage key prefixes), the first one is the main photo. */
    images: z
      .array(z.strictObject({ key: z.string().min(1), alt: z.string().trim().max(150, 'Use at most 150 characters.') }))
      .max(MAX_PRODUCT_IMAGES, `Add at most ${MAX_PRODUCT_IMAGES} photos.`)
      .default([]),
    variants: z.array(productFormVariantSchema).min(1, 'Add at least one variant.').max(50),
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
export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormData = z.output<typeof productFormSchema>;

export const NEW_VARIANT: ProductFormVariantInput = {
  sku: '',
  label: '',
  options: {},
  mrp: 0,
  price: 0,
  bulkTiers: [],
  stock: 0,
  lowStockThreshold: 5,
  isActive: true,
};

/** Form values for a saved product, or an empty "Add product" form. */
export function productFormValues(product: AdminProductDTO | undefined): ProductFormInput {
  if (!product) {
    return {
      name: '',
      slug: undefined,
      brandId: '',
      categoryId: '',
      type: undefined,
      unit: 'bag',
      status: 'hidden',
      description: '',
      specifications: [],
      seo: { title: undefined, description: undefined },
      images: [],
      variants: [{ ...NEW_VARIANT }],
    };
  }
  return {
    name: product.name,
    slug: product.slug,
    brandId: product.brandId,
    categoryId: product.categoryId,
    type: product.type ?? undefined,
    unit: product.unit,
    status: product.status,
    description: product.description,
    specifications: product.specifications.map((s) => ({ ...s })),
    seo: { title: product.seo.title ?? undefined, description: product.seo.description ?? undefined },
    images: product.images.map((image) => ({ key: image.key, alt: image.alt })),
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      options: { ...v.options },
      mrp: v.mrp,
      price: v.price,
      bulkTiers: v.bulkTiers.map((t) => ({ ...t })),
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      isActive: v.isActive,
    })),
  };
}

/** A variant as the API takes it (`stock` only where it may be set). */
function variantBody(variant: ProductFormVariantData) {
  return {
    sku: variant.sku,
    label: variant.label,
    options: variant.options,
    mrp: variant.mrp,
    price: variant.price,
    bulkTiers: variant.bulkTiers,
    lowStockThreshold: variant.lowStockThreshold,
    isActive: variant.isActive,
  };
}

/**
 * `POST /api/admin/products`. Opening stock is only sent by staff who may set stock; `id` is the id
 * the photos were uploaded under (the API checks they belong to it).
 */
export function createProductBody(values: ProductFormData, canSetStock: boolean, uploadedUnderId?: string) {
  return {
    ...(uploadedUnderId ? { id: uploadedUnderId } : {}),
    name: values.name,
    ...(values.slug ? { slug: values.slug } : {}),
    brandId: values.brandId,
    categoryId: values.categoryId,
    ...(values.type ? { type: values.type } : {}),
    unit: values.unit,
    description: values.description,
    specifications: values.specifications,
    seo: values.seo,
    status: values.status === 'active' ? ('active' as const) : ('hidden' as const),
    images: values.images,
    variants: values.variants.map((variant) => ({
      ...variantBody(variant),
      ...(canSetStock && variant.stock > 0 ? { stock: variant.stock } : {}),
    })),
  };
}

/**
 * `PATCH /api/admin/products/:id`: details plus every saved variant (same order as in the form, so
 * the API's `variants.N.field` errors land on the right row). Unchanged prices are fine to send:
 * the API only asks for price permission when a value actually changes.
 */
export function updateProductBody(values: ProductFormData) {
  return {
    name: values.name,
    ...(values.slug ? { slug: values.slug } : {}),
    brandId: values.brandId,
    categoryId: values.categoryId,
    type: values.type ?? null,
    unit: values.unit,
    description: values.description,
    specifications: values.specifications,
    seo: values.seo,
    images: values.images,
    variants: values.variants.flatMap((variant) => (variant.id ? [{ id: variant.id, ...variantBody(variant) }] : [])),
  };
}

/** `POST /api/admin/products/:id/variants` for a row added in the form. */
export function newVariantBody(variant: ProductFormVariantData, canSetStock: boolean) {
  return { ...variantBody(variant), ...(canSetStock && variant.stock > 0 ? { stock: variant.stock } : {}) };
}
