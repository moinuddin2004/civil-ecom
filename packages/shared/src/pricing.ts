import { MAX_BULK_TIERS, MIN_TIER_QTY } from './constants.js';

/**
 * Unit prices and bulk tiers (SPEC §6.1, §6.2). Pure functions; money is integer PKR.
 */

export interface BulkTier {
  minQty: number;
  price: number;
}

export interface VariantPricing {
  mrp: number;
  price: number;
  bulkTiers: readonly BulkTier[];
}

export interface UnitPriceResult {
  unitPrice: number;
  /** `minQty` of the tier that applied, or null when the base price applies. */
  appliedTierMinQty: number | null;
}

export function sortTiers(tiers: readonly BulkTier[]): BulkTier[] {
  return [...tiers].sort((a, b) => a.minQty - b.minQty);
}

/**
 * The applied tier is the one with the largest `minQty` ≤ qty; no tier → `variant.price`.
 * Example: price 425, tiers 10→415, 30→405, 50→395: qty 9 → 425, 10 → 415, 49 → 405, 50 → 395.
 */
export function getUnitPrice(variant: Pick<VariantPricing, 'price' | 'bulkTiers'>, qty: number): UnitPriceResult {
  let applied: BulkTier | null = null;
  for (const tier of sortTiers(variant.bulkTiers)) {
    if (tier.minQty <= qty) applied = tier;
    else break;
  }
  return applied
    ? { unitPrice: applied.price, appliedTierMinQty: applied.minQty }
    : { unitPrice: variant.price, appliedTierMinQty: null };
}

export interface NextTier extends BulkTier {
  /** How many more units reach this tier ("Add 3 more to pay Rs 405 each"). */
  qtyNeeded: number;
}

/** The next cheaper tier above `qty`, or null when none is left. */
export function nextTier(variant: Pick<VariantPricing, 'bulkTiers'>, qty: number): NextTier | null {
  const next = sortTiers(variant.bulkTiers).find((tier) => tier.minQty > qty);
  return next ? { ...next, qtyNeeded: next.minQty - qty } : null;
}

/** Lowest unit price reachable (the last tier, or the base price without tiers). */
export function lowestUnitPrice(variant: Pick<VariantPricing, 'price' | 'bulkTiers'>): number {
  return variant.bulkTiers.reduce((min, tier) => Math.min(min, tier.price), variant.price);
}

export function lineTotal(unitPrice: number, qty: number): number {
  return unitPrice * qty;
}

/** "You save" on a line: (mrp − unitPrice) × qty when positive. */
export function lineSavings(mrp: number, unitPrice: number, qty: number): number {
  return Math.max(0, (mrp - unitPrice) * qty);
}

/** Whole-number discount of `price` against `mrp` ("Save 3%"), 0 when there is none. */
export function discountPercent(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

/** One row of the bulk price ladder, e.g. "10–49 bags Rs 1,430". `maxQty` null = "and more". */
export interface LadderRow {
  minQty: number;
  maxQty: number | null;
  price: number;
}

/** Base price row from 1 plus one row per tier (the ladder on the product page, SPEC §8.5). */
export function priceLadder(variant: Pick<VariantPricing, 'price' | 'bulkTiers'>): LadderRow[] {
  const tiers = sortTiers(variant.bulkTiers);
  const starts = [{ minQty: 1, price: variant.price }, ...tiers];
  return starts.map((row, index) => {
    const next = starts[index + 1];
    return { minQty: row.minQty, maxQty: next ? next.minQty - 1 : null, price: row.price };
  });
}

/** Index of the ladder row that applies to `qty`. */
export function activeLadderIndex(ladder: readonly LadderRow[], qty: number): number {
  let index = 0;
  ladder.forEach((row, i) => {
    if (qty >= row.minQty) index = i;
  });
  return index;
}

/**
 * Position (0–100) of the quantity marker on the ladder's dimension line: the ladder rows are
 * spaced evenly and the marker moves proportionally inside a row.
 */
export function ladderMarkerPercent(ladder: readonly LadderRow[], qty: number): number {
  const count = ladder.length;
  if (count < 2) return 0;
  const last = ladder[count - 1];
  if (!last || qty >= last.minQty) return 100;
  for (let i = 0; i < count - 1; i++) {
    const row = ladder[i];
    const next = ladder[i + 1];
    if (!row || !next) break;
    if (qty < next.minQty) {
      const within = Math.max(0, qty - row.minQty) / (next.minQty - row.minQty);
      return ((i + within) / (count - 1)) * 100;
    }
  }
  return 100;
}

export interface PricingIssue {
  /** Path inside the variant, e.g. `['bulkTiers', 1, 'price']`. */
  path: (string | number)[];
  message: string;
}

/**
 * Validates a variant's prices and tiers (SPEC §6.1): `price` > 0, `mrp` ≥ `price`, at most 5
 * tiers, `minQty` ≥ 2 and strictly increasing, tier prices strictly decreasing and below `price`.
 * Returns every problem; an empty list means valid. Used by the Zod schemas (API) and the tier
 * editor (UI) so the messages match.
 */
export function validateVariantPricing(variant: VariantPricing): PricingIssue[] {
  const issues: PricingIssue[] = [];
  const isMoney = (n: number) => Number.isInteger(n) && n >= 0;

  if (!Number.isInteger(variant.price) || variant.price <= 0) {
    issues.push({ path: ['price'], message: 'Enter a price above Rs 0 in whole rupees.' });
  }
  if (!isMoney(variant.mrp)) {
    issues.push({ path: ['mrp'], message: 'Enter the MRP in whole rupees.' });
  } else if (variant.mrp < variant.price) {
    issues.push({ path: ['mrp'], message: "MRP can't be lower than the price." });
  }

  if (variant.bulkTiers.length > MAX_BULK_TIERS) {
    issues.push({ path: ['bulkTiers'], message: `Add at most ${MAX_BULK_TIERS} bulk tiers.` });
  }

  variant.bulkTiers.forEach((tier, index) => {
    const previous = index > 0 ? variant.bulkTiers[index - 1] : undefined;

    if (!Number.isInteger(tier.minQty) || tier.minQty < MIN_TIER_QTY) {
      issues.push({
        path: ['bulkTiers', index, 'minQty'],
        message: `Minimum quantity must be a whole number of at least ${MIN_TIER_QTY}.`,
      });
    } else if (previous && tier.minQty <= previous.minQty) {
      issues.push({
        path: ['bulkTiers', index, 'minQty'],
        message: 'Each tier needs a larger quantity than the one before.',
      });
    }

    if (!Number.isInteger(tier.price) || tier.price <= 0) {
      issues.push({
        path: ['bulkTiers', index, 'price'],
        message: 'Enter a tier price above Rs 0 in whole rupees.',
      });
    } else if (tier.price >= variant.price) {
      issues.push({
        path: ['bulkTiers', index, 'price'],
        message: 'Tier price must be lower than the base price.',
      });
    } else if (previous && tier.price >= previous.price) {
      issues.push({
        path: ['bulkTiers', index, 'price'],
        message: 'Each tier must be cheaper than the one before.',
      });
    }
  });

  return issues;
}
