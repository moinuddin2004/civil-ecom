import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import type { BrandLean } from '../../models/brand.model.js';
import type { CategoryLean } from '../../models/category.model.js';
import {
  buildCategoryTree,
  forEachFilterKey,
  toCategoryPage,
  toProductCard,
  toProductFacets,
  varyingOptionKeys,
  type CardSource,
} from './catalog.mappers.js';

function variant(overrides: Partial<CardSource['variants'][number]> = {}): CardSource['variants'][number] {
  return {
    _id: new Types.ObjectId(),
    mrp: 1_500,
    price: 1_450,
    bulkTiers: [],
    stock: 100,
    lowStockThreshold: 5,
    isActive: true,
    ...overrides,
  };
}

function product(variants: CardSource['variants']): CardSource {
  return {
    _id: new Types.ObjectId(),
    slug: 'bestway-cement-ppc',
    name: 'Bestway Cement PPC',
    brandName: 'Bestway Cement',
    unit: 'bag',
    images: [],
    minPrice: Math.min(...variants.filter((v) => v.isActive).map((v) => v.price)),
    maxPrice: Math.max(...variants.filter((v) => v.isActive).map((v) => v.price)),
    variants,
  };
}

describe('toProductCard (SPEC §7.2, §8.4)', () => {
  it('summarises active variants: cheapest MRP, lowest tier, default variant', () => {
    const cheap = variant({ price: 1_400, mrp: 1_480, stock: 0 });
    const inStock = variant({ price: 1_450, bulkTiers: [{ minQty: 10, price: 1_430 }, { minQty: 50, price: 1_395 }] });
    const inactive = variant({ price: 900, isActive: false, bulkTiers: [{ minQty: 10, price: 800 }] });
    const card = toProductCard(product([cheap, inStock, inactive]));

    expect(card.mrpOfMin).toBe(1_480);
    expect(card.lowestTierPrice).toBe(1_395);
    expect(card.variantCount).toBe(2);
    expect(card.inStock).toBe(true);
    // The first active variant that can actually be added.
    expect(card.defaultVariantId).toBe(String(inStock._id));
    expect(card.imageKey).toBeNull();
  });

  it('shows "Only N left" from the default variant at or below its threshold', () => {
    expect(toProductCard(product([variant({ stock: 4, lowStockThreshold: 5 })])).lowStockCount).toBe(4);
    expect(toProductCard(product([variant({ stock: 6, lowStockThreshold: 5 })])).lowStockCount).toBeNull();
  });

  it('marks a product with no stock anywhere as out of stock', () => {
    const card = toProductCard(product([variant({ stock: 0 })]));
    expect(card.inStock).toBe(false);
    expect(card.lowStockCount).toBeNull();
  });
});

describe('varyingOptionKeys', () => {
  it('offers chips only for options that differ between variants', () => {
    expect(
      varyingOptionKeys([
        { options: { size: '60×60 cm', colour: 'Ivory' } },
        { options: { size: '60×60 cm', colour: 'Grey' } },
      ]),
    ).toEqual(['colour']);
  });
});

const NOW = new Date('2026-09-01T00:00:00Z');

function category(name: string, slug: string, parent: CategoryLean | null = null): CategoryLean {
  return {
    _id: new Types.ObjectId(),
    name,
    slug,
    parentId: parent ? parent._id : null,
    sortOrder: 0,
    showOnHome: false,
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function brand(name: string, slug: string): BrandLean {
  return { _id: new Types.ObjectId(), name, slug, sortOrder: 0, status: 'active', createdAt: NOW, updatedAt: NOW };
}

describe('category tree and pages', () => {
  const cement = category('Cement & plaster', 'cement-plaster');
  const opc = category('OPC cement', 'opc-cement', cement);
  const white = category('White cement', 'white-cement', cement);
  const tiles = category('Tiles', 'tiles');
  const all = [cement, opc, white, tiles];
  const counts = new Map([
    [String(cement._id), 5],
    [String(opc._id), 3],
    [String(white._id), 2],
  ]);

  it('nests sub-categories under their parent with counts', () => {
    const tree = buildCategoryTree(all, counts);
    expect(tree.map((node) => node.slug)).toEqual(['cement-plaster', 'tiles']);
    expect(tree[0]?.productCount).toBe(5);
    expect(tree[0]?.children.map((node) => [node.slug, node.productCount])).toEqual([
      ['opc-cement', 3],
      ['white-cement', 2],
    ]);
    expect(tree[1]).toMatchObject({ productCount: 0, children: [] });
  });

  it('a top-level page lists its own sub-categories', () => {
    const page = toCategoryPage(cement, null, all, counts);
    expect(page.parent).toBeNull();
    expect(page.children.map((node) => node.slug)).toEqual(['opc-cement', 'white-cement']);
    expect(page.breadcrumbs).toEqual([{ name: 'Cement & plaster', slug: 'cement-plaster' }]);
  });

  it('a sub-category page lists its siblings and has a two-step breadcrumb', () => {
    const page = toCategoryPage(opc, cement, all, counts);
    expect(page.parent).toEqual({ id: String(cement._id), name: 'Cement & plaster', slug: 'cement-plaster' });
    expect(page.children.map((node) => node.slug)).toEqual(['opc-cement', 'white-cement']);
    expect(page.category).toMatchObject({ slug: 'opc-cement', productCount: 3, children: [] });
    expect(page.breadcrumbs.map((crumb) => crumb.slug)).toEqual(['cement-plaster', 'opc-cement']);
  });
});

describe('toProductFacets', () => {
  const lucky = brand('Lucky Cement', 'lucky-cement');
  const dg = brand('DG Cement', 'dg-cement');
  const noValues = forEachFilterKey(() => []);

  it('names brand rows, drops brands that are no longer active, and sorts by count then name', () => {
    const facets = toProductFacets(
      {
        brands: [
          { _id: lucky._id, count: 2 },
          { _id: new Types.ObjectId(), count: 9 },
          { _id: dg._id, count: 2 },
        ],
        price: [{ min: 900, max: 1_600 }],
        values: { ...noValues, packSize: [{ _id: '40 kg', count: 1 }, { _id: '50 kg', count: 7 }] },
      },
      [lucky, dg],
    );

    expect(facets.brands.map((row) => [row.slug, row.count])).toEqual([
      ['dg-cement', 2],
      ['lucky-cement', 2],
    ]);
    expect(facets.price).toEqual({ min: 900, max: 1_600 });
    expect(facets.values.packSize).toEqual([
      { value: '50 kg', count: 7 },
      { value: '40 kg', count: 1 },
    ]);
    expect(facets.values.colour).toEqual([]);
  });

  it('has no price range when nothing matches', () => {
    expect(toProductFacets({ brands: [], price: [], values: noValues }, []).price).toBeNull();
  });
});
