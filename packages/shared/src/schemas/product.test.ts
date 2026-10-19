import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { validateVariantPricing, type BulkTier } from '../pricing.js';
import {
  productCreateSchema,
  productListQuery,
  productUpdateSchema,
  skuSchema,
  stockAdjustmentSchema,
  variantCreateSchema,
  variantUpdateSchema,
} from './product.js';

function issues(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map(({ path, message, code }) => ({ path, message, code }));
}

const BRAND = '64b7f0c2e4b0a1a2b3c4d5e6';
const CATEGORY = '64b7f0c2e4b0a1a2b3c4d5e7';
const VARIANT_ID = '64b7f0c2e4b0a1a2b3c4d5e8';
const TIERS: BulkTier[] = [
  { minQty: 10, price: 415 },
  { minQty: 30, price: 405 },
  { minQty: 50, price: 395 },
];

const variant = { sku: 'lucky-opc-50', label: '50 kg bag', mrp: 440, price: 425, bulkTiers: TIERS, stock: 100 };
const product = { name: 'OPC Cement', brandId: BRAND, categoryId: CATEGORY, unit: 'bag', variants: [variant] };

describe('productCreateSchema', () => {
  it('parses a product, upper-cases SKUs and fills defaults', () => {
    const data = productCreateSchema.parse(product);
    expect(data).toMatchObject({
      name: 'OPC Cement',
      status: 'hidden',
      description: '',
      specifications: [],
      images: [],
      isFeatured: false,
      relatedProductIds: [],
      seo: {},
    });
    expect(data.variants[0]).toMatchObject({
      sku: 'LUCKY-OPC-50',
      options: {},
      bulkTiers: TIERS,
      isActive: true,
      stock: 100,
    });
  });

  const badPricing: [string, { mrp: number; price: number; bulkTiers: BulkTier[] }][] = [
    ['a tier from 1 unit', { mrp: 440, price: 425, bulkTiers: [{ minQty: 1, price: 415 }] }],
    [
      'repeated tier quantities',
      {
        mrp: 440,
        price: 425,
        bulkTiers: [
          { minQty: 10, price: 415 },
          { minQty: 10, price: 405 },
        ],
      },
    ],
    [
      'tier prices going up',
      {
        mrp: 440,
        price: 425,
        bulkTiers: [
          { minQty: 10, price: 405 },
          { minQty: 30, price: 415 },
        ],
      },
    ],
    ['a tier at the base price', { mrp: 440, price: 425, bulkTiers: [{ minQty: 10, price: 425 }] }],
    ['an MRP below the price', { mrp: 420, price: 425, bulkTiers: [] }],
    ['a price of 0', { mrp: 0, price: 0, bulkTiers: [] }],
  ];

  it.each(badPricing)('rejects %s with the validateVariantPricing message', (_label, pricing) => {
    const expected = validateVariantPricing(pricing).map((issue) => ({
      path: ['variants', 0, ...issue.path],
      message: issue.message,
      code: 'custom',
    }));
    expect(expected.length).toBeGreaterThan(0);
    expect(issues(productCreateSchema, { ...product, variants: [{ ...variant, ...pricing }] })).toEqual(expected);
  });

  it('rejects more than 5 tiers', () => {
    const six = [2, 5, 10, 20, 40, 60].map((minQty, i) => ({ minQty, price: 420 - i * 5 }));
    const result = issues(productCreateSchema, { ...product, variants: [{ ...variant, bulkTiers: six }] });
    expect(result.map((i) => i.path)).toEqual([['variants', 0, 'bulkTiers']]);
    expect(result[0]?.message).toBe('Add at most 5 bulk tiers.');
  });

  it('gives a field one message when a basic check already failed', () => {
    expect(issues(productCreateSchema, { ...product, variants: [{ ...variant, mrp: -5 }] })).toEqual([
      { path: ['variants', 0, 'mrp'], message: "Amount can't be negative.", code: 'too_small' },
    ]);
  });

  it('rejects non-integer money and tier quantities', () => {
    const at = (patch: object) =>
      issues(productCreateSchema, { ...product, variants: [{ ...variant, ...patch }] }).map((i) => i.path);
    expect(at({ price: 425.5 })).toEqual([['variants', 0, 'price']]);
    expect(at({ mrp: 440.25 })).toEqual([['variants', 0, 'mrp']]);
    expect(at({ bulkTiers: [{ minQty: 10.5, price: 415 }] })).toEqual([['variants', 0, 'bulkTiers', 0, 'minQty']]);
    expect(at({ bulkTiers: [{ minQty: 10, price: 414.5 }] })).toEqual([['variants', 0, 'bulkTiers', 0, 'price']]);
  });

  it('rejects duplicate SKUs, comparing them after trimming and upper-casing', () => {
    const result = issues(productCreateSchema, {
      ...product,
      variants: [variant, { ...variant, sku: '  LUCKY-opc-50 ', label: 'Second' }],
    });
    expect(result).toEqual([{ path: ['variants', 1, 'sku'], message: 'Each SKU must be unique.', code: 'custom' }]);
  });

  it('needs at least one variant', () => {
    expect(issues(productCreateSchema, { ...product, variants: [] })).toEqual([
      expect.objectContaining({ path: ['variants'], message: 'Add at least one variant.' }),
    ]);
  });

  it.each(['minPrice', 'maxPrice', 'totalStock', 'filters', 'categoryPath', 'brandName', 'slugHistory'])(
    'rejects the computed or unknown field %s',
    (key) => {
      expect(issues(productCreateSchema, { ...product, [key]: 1 })[0]?.code).toBe('unrecognized_keys');
    },
  );

  it('rejects unknown variant fields and negative or fractional stock', () => {
    const at = (patch: object) => issues(productCreateSchema, { ...product, variants: [{ ...variant, ...patch }] });
    expect(at({ costPrice: 300 })[0]?.code).toBe('unrecognized_keys');
    expect(at({ stock: -1 })).not.toEqual([]);
    expect(at({ stock: 1.5 })).not.toEqual([]);
  });

  it('enforces the SPEC §5.6 limits', () => {
    const at = (patch: object) => issues(productCreateSchema, { ...product, ...patch }).map((i) => i.path[0]);
    expect(at({ name: 'OP' })).toEqual(['name']);
    expect(at({ name: 'x'.repeat(151) })).toEqual(['name']);
    expect(at({ unit: 'ton' })).toEqual(['unit']);
    expect(at({ description: 'x'.repeat(20_001) })).toEqual(['description']);
    expect(at({ description: 'x'.repeat(20_000) })).toEqual([]);
    const spec = { label: 'Weight', value: '50 kg' };
    expect(at({ specifications: Array.from({ length: 41 }, () => spec) })).toEqual(['specifications']);
    const image = { key: `products/${BRAND}/${CATEGORY}`, alt: '' };
    expect(at({ images: Array.from({ length: 11 }, () => image) })).toEqual(['images']);
    expect(at({ images: [image] })).toEqual([]);
    const ids = Array.from({ length: 9 }, (_, i) => `64b7f0c2e4b0a1a2b3c4d5${String(i).padStart(2, '0')}`);
    expect(at({ relatedProductIds: ids })).toEqual(['relatedProductIds']);
    expect(at({ relatedProductIds: [BRAND, BRAND] })).toEqual(['relatedProductIds']);
  });

  it('rejects image keys that did not come from the upload endpoint', () => {
    const at = (key: string) => issues(productCreateSchema, { ...product, images: [{ key }] }).map((i) => i.path[0]);
    expect(at('../../etc/passwd')).toEqual(['images']);
    expect(at(`products/${BRAND}/${CATEGORY}/300.webp`)).toEqual(['images']);
    expect(at('https://example.com/a.jpg')).toEqual(['images']);
  });
});

describe('variantCreateSchema and variantUpdateSchema', () => {
  it('validates pricing on a new variant', () => {
    expect(issues(variantCreateSchema, variant)).toEqual([]);
    expect(issues(variantCreateSchema, { ...variant, mrp: 400 }).map((i) => i.message)).toEqual([
      "MRP can't be lower than the price.",
    ]);
  });

  it('never accepts stock on a variant update (SPEC §6.10)', () => {
    expect(issues(variantUpdateSchema, { label: 'New label' })).toEqual([]);
    expect(issues(variantUpdateSchema, { stock: 5 })[0]?.code).toBe('unrecognized_keys');
  });
});

describe('productUpdateSchema (SPEC §6.10: edit endpoints never accept stock)', () => {
  it('accepts detail and per-variant label changes', () => {
    expect(
      productUpdateSchema.parse({ name: 'OPC Cement 53', variants: [{ id: VARIANT_ID, label: '50 kg bag, OPC 53' }] }),
    ).toEqual({ name: 'OPC Cement 53', variants: [{ id: VARIANT_ID, label: '50 kg bag, OPC 53' }] });
    expect(productUpdateSchema.parse({})).toEqual({});
  });

  it('rejects a stock key on a variant', () => {
    const result = issues(productUpdateSchema, { variants: [{ id: VARIANT_ID, stock: 500 }] });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ path: ['variants', 0], code: 'unrecognized_keys' });
  });

  it.each(['stock', 'totalStock', 'status', 'minPrice'])('rejects %s at the top level', (key) => {
    expect(issues(productUpdateSchema, { [key]: 1 })[0]?.code).toBe('unrecognized_keys');
  });

  it('needs the variant id for variant changes', () => {
    expect(issues(productUpdateSchema, { variants: [{ label: 'x' }] }).map((i) => i.path)).toEqual([
      ['variants', 0, 'id'],
    ]);
  });

  it('clears the type with null or an empty string', () => {
    expect(productUpdateSchema.parse({ type: null })).toEqual({ type: null });
    expect(productUpdateSchema.parse({ type: '  ' })).toEqual({ type: null });
  });
});

describe('skuSchema', () => {
  it('trims and upper-cases', () => {
    expect(skuSchema.parse('  lucky-opc.50_a ')).toBe('LUCKY-OPC.50_A');
  });

  it.each(['A', 'AB C', '-AB', 'AB/C', 'x'.repeat(41), ''])('rejects %j', (value) => {
    expect(skuSchema.safeParse(value).success).toBe(false);
  });
});

describe('stockAdjustmentSchema', () => {
  it('needs a non-zero whole change and a reason', () => {
    expect(issues(stockAdjustmentSchema, { variantId: VARIANT_ID, change: -3, reason: 'Damaged bags' })).toEqual([]);
    expect(issues(stockAdjustmentSchema, { variantId: VARIANT_ID, change: 0, reason: 'Recount' }).map((i) => i.path)).toEqual([
      ['change'],
    ]);
    expect(issues(stockAdjustmentSchema, { variantId: VARIANT_ID, change: 1.5, reason: 'Recount' })).not.toEqual([]);
    expect(issues(stockAdjustmentSchema, { variantId: VARIANT_ID, change: 5, reason: '  ' }).map((i) => i.path)).toEqual([
      ['reason'],
    ]);
  });
});

describe('productListQuery (query strings arrive as text)', () => {
  it('coerces paging, splits lists and parses booleans', () => {
    expect(
      productListQuery.parse({ page: '2', pageSize: '48', brand: 'lucky, dg-khan,,', inStock: 'true', sort: 'price_asc' }),
    ).toEqual({ page: 2, pageSize: 48, brand: ['lucky', 'dg-khan'], inStock: true, sort: 'price_asc' });
    expect(productListQuery.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('caps the page size at 100 and rejects unknown values and keys', () => {
    expect(issues(productListQuery, { pageSize: '100' })).toEqual([]);
    expect(issues(productListQuery, { pageSize: '101' }).map((i) => i.path)).toEqual([['pageSize']]);
    expect(issues(productListQuery, { inStock: 'yes' }).map((i) => i.path)).toEqual([['inStock']]);
    expect(issues(productListQuery, { sort: 'cheapest' }).map((i) => i.path)).toEqual([['sort']]);
    expect(issues(productListQuery, { $where: '1' })[0]?.code).toBe('unrecognized_keys');
  });
});
