import { FILTER_KEYS, type FilterKey, type ProductSort } from '@aricon/shared';
import type { PipelineStage, Types } from 'mongoose';

/**
 * Builds the single aggregation behind `GET /api/products` (SPEC §7.2): one page of cards, the
 * total, and facet counts where **each facet ignores its own filter** (so ticking "Lucky Cement"
 * still shows how many products the other brands have). Pure, so it is unit-tested directly.
 *
 * Aggregation pipelines are not touched by Mongoose's `sanitizeFilter`; every value here comes from
 * a validated DTO (strings, numbers, ObjectIds), never a raw request object.
 */

export interface ListingCriteria {
  /** A category id: matches the category and its sub-categories (`categoryPath`). */
  categoryId?: Types.ObjectId;
  /** `null` = a brand filter was given but matched no brand (→ no results). */
  brandIds?: Types.ObjectId[] | null;
  /** Full-text search on name and brand (`$text`, the product text index). */
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  values: Partial<Record<FilterKey, string[]>>;
  inStock?: boolean;
  sort: ProductSort;
  page: number;
  pageSize: number;
}

type Facet = 'brand' | 'price' | FilterKey;

/** The base match: what every part of the result (page and facets) shares. */
export function baseMatch(criteria: ListingCriteria): Record<string, unknown> {
  const match: Record<string, unknown> = { status: 'active' };
  if (criteria.q) match.$text = { $search: criteria.q };
  if (criteria.categoryId) match.categoryPath = criteria.categoryId;
  return match;
}

/** The optional filters, leaving out the one a facet is about. */
export function filterMatch(criteria: ListingCriteria, except?: Facet): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  if (except !== 'brand' && criteria.brandIds !== undefined) {
    and.push({ brandId: { $in: criteria.brandIds ?? [] } });
  }
  if (except !== 'price') {
    // A product's price range overlaps the requested range.
    if (criteria.minPrice !== undefined) and.push({ maxPrice: { $gte: criteria.minPrice } });
    if (criteria.maxPrice !== undefined) and.push({ minPrice: { $lte: criteria.maxPrice } });
  }
  for (const key of FILTER_KEYS) {
    const wanted = criteria.values[key];
    if (except !== key && wanted && wanted.length > 0) and.push({ [`filters.${key}`]: { $in: wanted } });
  }
  if (criteria.inStock) and.push({ totalStock: { $gt: 0 } });

  return and.length > 0 ? { $and: and } : {};
}

export function sortStage(criteria: ListingCriteria): Record<string, 1 | -1 | { $meta: 'textScore' }> {
  switch (criteria.sort) {
    case 'price_asc':
      return { minPrice: 1, _id: 1 };
    case 'price_desc':
      return { minPrice: -1, _id: -1 };
    case 'newest':
      return { createdAt: -1, _id: -1 };
    case 'relevance':
      // With search text, best matches first; without it, featured products, then newest.
      return criteria.q ? { score: { $meta: 'textScore' }, _id: 1 } : { isFeatured: -1, createdAt: -1, _id: -1 };
  }
}

/** Fields a product card needs (SPEC §7.2 `ProductCard`). */
export const CARD_PROJECTION = {
  slug: 1,
  name: 1,
  brandName: 1,
  unit: 1,
  images: { $slice: ['$images', 1] },
  minPrice: 1,
  maxPrice: 1,
  'variants._id': 1,
  'variants.mrp': 1,
  'variants.price': 1,
  'variants.bulkTiers': 1,
  'variants.stock': 1,
  'variants.lowStockThreshold': 1,
  'variants.isActive': 1,
} as const;

function valueFacet(criteria: ListingCriteria, key: FilterKey): PipelineStage.FacetPipelineStage[] {
  return [
    { $match: filterMatch(criteria, key) },
    { $unwind: `$filters.${key}` },
    { $group: { _id: `$filters.${key}`, count: { $sum: 1 } } },
  ];
}

export function listingPipeline(criteria: ListingCriteria): PipelineStage[] {
  const all = filterMatch(criteria);
  return [
    // `$text` must be in the first stage of the pipeline.
    { $match: baseMatch(criteria) },
    {
      $facet: {
        results: [
          { $match: all },
          { $sort: sortStage(criteria) },
          { $skip: (criteria.page - 1) * criteria.pageSize },
          { $limit: criteria.pageSize },
          { $project: CARD_PROJECTION },
        ],
        total: [{ $match: all }, { $count: 'count' }],
        brands: [
          { $match: filterMatch(criteria, 'brand') },
          { $group: { _id: '$brandId', count: { $sum: 1 } } },
        ],
        price: [
          { $match: filterMatch(criteria, 'price') },
          { $group: { _id: null, min: { $min: '$minPrice' }, max: { $max: '$maxPrice' } } },
        ],
        type: valueFacet(criteria, 'type'),
        packSize: valueFacet(criteria, 'packSize'),
        grade: valueFacet(criteria, 'grade'),
        colour: valueFacet(criteria, 'colour'),
        size: valueFacet(criteria, 'size'),
      },
    },
  ];
}
