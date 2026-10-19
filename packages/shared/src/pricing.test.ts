import { describe, expect, it } from 'vitest';
import {
  activeLadderIndex,
  discountPercent,
  getUnitPrice,
  ladderMarkerPercent,
  lineSavings,
  lineTotal,
  lowestUnitPrice,
  nextTier,
  priceLadder,
  sortTiers,
  validateVariantPricing,
  type BulkTier,
  type VariantPricing,
} from './pricing.js';

/** The SPEC §6.1 example: price 425, tiers 10 → 415, 30 → 405, 50 → 395. */
const TIERS: BulkTier[] = [
  { minQty: 10, price: 415 },
  { minQty: 30, price: 405 },
  { minQty: 50, price: 395 },
];
const cement: VariantPricing = { mrp: 440, price: 425, bulkTiers: TIERS };
const shuffled: VariantPricing = { ...cement, bulkTiers: [TIERS[2]!, TIERS[0]!, TIERS[1]!] };
const noTiers: VariantPricing = { mrp: 440, price: 425, bulkTiers: [] };

describe('getUnitPrice (SPEC §6.1)', () => {
  it.each([
    [1, 425, null],
    [9, 425, null],
    [10, 415, 10],
    [11, 415, 10],
    [29, 415, 10],
    [30, 405, 30],
    [49, 405, 30],
    [50, 395, 50],
    [51, 395, 50],
    [9999, 395, 50],
  ])('qty %i → Rs %i (tier %s)', (qty, unitPrice, appliedTierMinQty) => {
    expect(getUnitPrice(cement, qty)).toEqual({ unitPrice, appliedTierMinQty });
  });

  it('sorts tiers itself, so an unsorted list prices the same', () => {
    for (const qty of [1, 9, 10, 29, 30, 49, 50, 9999]) {
      expect(getUnitPrice(shuffled, qty)).toEqual(getUnitPrice(cement, qty));
    }
  });

  it('does not reorder the caller’s tier array', () => {
    const tiers = [...shuffled.bulkTiers];
    getUnitPrice(shuffled, 40);
    nextTier(shuffled, 40);
    priceLadder(shuffled);
    expect(shuffled.bulkTiers).toEqual(tiers);
  });

  it('uses the base price when there are no tiers', () => {
    expect(getUnitPrice(noTiers, 1)).toEqual({ unitPrice: 425, appliedTierMinQty: null });
    expect(getUnitPrice(noTiers, 9999)).toEqual({ unitPrice: 425, appliedTierMinQty: null });
  });

  it('applies a single tier from its minimum quantity', () => {
    const variant = { price: 1000, bulkTiers: [{ minQty: 2, price: 950 }] };
    expect(getUnitPrice(variant, 1)).toEqual({ unitPrice: 1000, appliedTierMinQty: null });
    expect(getUnitPrice(variant, 2)).toEqual({ unitPrice: 950, appliedTierMinQty: 2 });
  });
});

describe('sortTiers', () => {
  it('returns a new array in ascending minQty order', () => {
    const sorted = sortTiers(shuffled.bulkTiers);
    expect(sorted.map((t) => t.minQty)).toEqual([10, 30, 50]);
    expect(sorted).not.toBe(shuffled.bulkTiers);
  });
});

describe('nextTier (the "Add 3 more to pay Rs 405 each" nudge)', () => {
  it('returns the next cheaper tier and how many more units reach it', () => {
    expect(nextTier(cement, 27)).toEqual({ minQty: 30, price: 405, qtyNeeded: 3 });
    expect(nextTier(cement, 7)).toEqual({ minQty: 10, price: 415, qtyNeeded: 3 });
    expect(nextTier(cement, 1)).toEqual({ minQty: 10, price: 415, qtyNeeded: 9 });
  });

  it('points past the tier that already applies at its exact minimum', () => {
    expect(nextTier(cement, 10)).toEqual({ minQty: 30, price: 405, qtyNeeded: 20 });
    expect(nextTier(cement, 49)).toEqual({ minQty: 50, price: 395, qtyNeeded: 1 });
  });

  it('returns null once the last tier applies or there are no tiers', () => {
    expect(nextTier(cement, 50)).toBeNull();
    expect(nextTier(cement, 9999)).toBeNull();
    expect(nextTier(noTiers, 1)).toBeNull();
  });

  it('works on unsorted tiers', () => {
    expect(nextTier(shuffled, 27)).toEqual({ minQty: 30, price: 405, qtyNeeded: 3 });
  });
});

describe('lowestUnitPrice', () => {
  it('is the cheapest tier, or the base price without tiers', () => {
    expect(lowestUnitPrice(cement)).toBe(395);
    expect(lowestUnitPrice(shuffled)).toBe(395);
    expect(lowestUnitPrice(noTiers)).toBe(425);
  });
});

describe('line totals and savings (SPEC §6.2)', () => {
  it('lineTotal = unitPrice × qty in whole rupees', () => {
    expect(lineTotal(415, 12)).toBe(4980);
    expect(lineTotal(395, 9999)).toBe(3_949_605);
    expect(Number.isInteger(lineTotal(425, 3))).toBe(true);
  });

  it('"You save" = (mrp − unitPrice) × qty when positive, never negative', () => {
    expect(lineSavings(440, 415, 12)).toBe(300);
    expect(lineSavings(440, 440, 12)).toBe(0);
    expect(lineSavings(400, 425, 12)).toBe(0);
  });

  it('discountPercent rounds to a whole percent and is 0 without a discount', () => {
    expect(discountPercent(440, 425)).toBe(3);
    expect(discountPercent(1000, 875)).toBe(13);
    expect(discountPercent(1000, 500)).toBe(50);
    expect(discountPercent(425, 425)).toBe(0);
    expect(discountPercent(400, 425)).toBe(0);
    expect(discountPercent(0, 0)).toBe(0);
  });
});

describe('priceLadder, activeLadderIndex, ladderMarkerPercent (SPEC §8.5)', () => {
  const ladder = priceLadder(cement);

  it('starts at 1 with the base price and closes each row before the next tier', () => {
    expect(ladder).toEqual([
      { minQty: 1, maxQty: 9, price: 425 },
      { minQty: 10, maxQty: 29, price: 415 },
      { minQty: 30, maxQty: 49, price: 405 },
      { minQty: 50, maxQty: null, price: 395 },
    ]);
  });

  it('is built from sorted tiers and has a single open row without tiers', () => {
    expect(priceLadder(shuffled)).toEqual(ladder);
    expect(priceLadder(noTiers)).toEqual([{ minQty: 1, maxQty: null, price: 425 }]);
  });

  it('agrees with getUnitPrice at every quantity', () => {
    for (let qty = 1; qty <= 60; qty++) {
      const row = ladder[activeLadderIndex(ladder, qty)];
      expect(row?.price).toBe(getUnitPrice(cement, qty).unitPrice);
    }
  });

  it.each([
    [0, 0],
    [1, 0],
    [9, 0],
    [10, 1],
    [29, 1],
    [30, 2],
    [49, 2],
    [50, 3],
    [9999, 3],
  ])('activeLadderIndex(qty %i) → row %i', (qty, index) => {
    expect(activeLadderIndex(ladder, qty)).toBe(index);
  });

  it('places the marker on evenly spaced rows and moves it inside a row', () => {
    expect(ladderMarkerPercent(ladder, 1)).toBe(0);
    expect(ladderMarkerPercent(ladder, 10)).toBeCloseTo(100 / 3);
    expect(ladderMarkerPercent(ladder, 20)).toBeCloseTo(50);
    expect(ladderMarkerPercent(ladder, 30)).toBeCloseTo(200 / 3);
    expect(ladderMarkerPercent(ladder, 50)).toBe(100);
    expect(ladderMarkerPercent(ladder, 9999)).toBe(100);
  });

  it('keeps the marker within 0–100 and never moves it backwards as qty grows', () => {
    let previous = -1;
    for (let qty = 0; qty <= 80; qty++) {
      const percent = ladderMarkerPercent(ladder, qty);
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
      expect(percent).toBeGreaterThanOrEqual(previous);
      previous = percent;
    }
  });

  it('returns 0 for a ladder without tiers', () => {
    expect(ladderMarkerPercent(priceLadder(noTiers), 500)).toBe(0);
    expect(ladderMarkerPercent([], 5)).toBe(0);
  });
});

describe('validateVariantPricing (SPEC §6.1 tier validation)', () => {
  const paths = (variant: VariantPricing) => validateVariantPricing(variant).map((issue) => issue.path);

  it('accepts the SPEC example, no tiers, 5 tiers and a tier from 2 units', () => {
    expect(validateVariantPricing(cement)).toEqual([]);
    expect(validateVariantPricing(noTiers)).toEqual([]);
    expect(validateVariantPricing({ mrp: 425, price: 425, bulkTiers: [{ minQty: 2, price: 424 }] })).toEqual([]);
    expect(
      validateVariantPricing({
        mrp: 500,
        price: 500,
        bulkTiers: [
          { minQty: 5, price: 490 },
          { minQty: 10, price: 480 },
          { minQty: 20, price: 470 },
          { minQty: 50, price: 460 },
          { minQty: 100, price: 450 },
        ],
      }),
    ).toEqual([]);
  });

  it('rejects a minQty below 2', () => {
    for (const minQty of [1, 0, -5]) {
      const issues = validateVariantPricing({ ...cement, bulkTiers: [{ minQty, price: 415 }] });
      expect(issues).toEqual([
        {
          path: ['bulkTiers', 0, 'minQty'],
          message: 'Minimum quantity must be a whole number of at least 2.',
        },
      ]);
    }
  });

  it('rejects quantities that are not strictly increasing', () => {
    const equal = validateVariantPricing({
      ...cement,
      bulkTiers: [
        { minQty: 10, price: 415 },
        { minQty: 10, price: 405 },
      ],
    });
    expect(equal).toEqual([
      { path: ['bulkTiers', 1, 'minQty'], message: 'Each tier needs a larger quantity than the one before.' },
    ]);

    const descending = paths({
      ...cement,
      bulkTiers: [
        { minQty: 30, price: 415 },
        { minQty: 10, price: 405 },
      ],
    });
    expect(descending).toContainEqual(['bulkTiers', 1, 'minQty']);
  });

  it('rejects tier prices that are not strictly decreasing', () => {
    const equal = validateVariantPricing({
      ...cement,
      bulkTiers: [
        { minQty: 10, price: 415 },
        { minQty: 30, price: 415 },
      ],
    });
    expect(equal).toEqual([
      { path: ['bulkTiers', 1, 'price'], message: 'Each tier must be cheaper than the one before.' },
    ]);

    const rising = paths({
      ...cement,
      bulkTiers: [
        { minQty: 10, price: 405 },
        { minQty: 30, price: 415 },
      ],
    });
    expect(rising).toEqual([['bulkTiers', 1, 'price']]);
  });

  it('rejects a tier price equal to or above the base price', () => {
    for (const price of [425, 430]) {
      expect(validateVariantPricing({ ...cement, bulkTiers: [{ minQty: 10, price }] })).toEqual([
        { path: ['bulkTiers', 0, 'price'], message: 'Tier price must be lower than the base price.' },
      ]);
    }
  });

  it('rejects an MRP below the price but allows MRP equal to the price', () => {
    expect(validateVariantPricing({ ...noTiers, mrp: 424 })).toEqual([
      { path: ['mrp'], message: "MRP can't be lower than the price." },
    ]);
    expect(validateVariantPricing({ ...noTiers, mrp: 425 })).toEqual([]);
  });

  it('rejects more than 5 tiers', () => {
    const six = [2, 5, 10, 20, 50, 100].map((minQty, i) => ({ minQty, price: 420 - i * 5 }));
    expect(validateVariantPricing({ mrp: 425, price: 425, bulkTiers: six })).toEqual([
      { path: ['bulkTiers'], message: 'Add at most 5 bulk tiers.' },
    ]);
  });

  it('rejects a price of 0 or below', () => {
    expect(paths({ mrp: 0, price: 0, bulkTiers: [] })).toContainEqual(['price']);
    expect(paths({ mrp: 10, price: -10, bulkTiers: [] })).toContainEqual(['price']);
  });

  it('rejects non-integer money and quantities (money is whole PKR)', () => {
    expect(paths({ ...noTiers, price: 425.5, mrp: 440 })).toEqual([['price']]);
    expect(paths({ ...noTiers, mrp: 440.5 })).toEqual([['mrp']]);
    expect(paths({ ...cement, bulkTiers: [{ minQty: 10.5, price: 415 }] })).toEqual([['bulkTiers', 0, 'minQty']]);
    expect(paths({ ...cement, bulkTiers: [{ minQty: 10, price: 414.5 }] })).toEqual([['bulkTiers', 0, 'price']]);
    expect(paths({ ...noTiers, price: Number.NaN })).toContainEqual(['price']);
  });

  it('rejects a tier price of 0 or below', () => {
    expect(paths({ ...cement, bulkTiers: [{ minQty: 10, price: 0 }] })).toEqual([['bulkTiers', 0, 'price']]);
    expect(paths({ ...cement, bulkTiers: [{ minQty: 10, price: -1 }] })).toEqual([['bulkTiers', 0, 'price']]);
  });

  it('reports every problem at once', () => {
    const issues = paths({
      mrp: 400,
      price: 425,
      bulkTiers: [
        { minQty: 1, price: 415 },
        { minQty: 30, price: 430 },
      ],
    });
    expect(issues).toEqual([['mrp'], ['bulkTiers', 0, 'minQty'], ['bulkTiers', 1, 'price']]);
  });
});
