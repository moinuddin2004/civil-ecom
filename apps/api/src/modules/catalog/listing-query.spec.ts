import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { baseMatch, filterMatch, listingPipeline, sortStage, type ListingCriteria } from './listing-query.js';

const lucky = new Types.ObjectId();
const cement = new Types.ObjectId();

function criteria(overrides: Partial<ListingCriteria> = {}): ListingCriteria {
  return { values: {}, sort: 'relevance', page: 1, pageSize: 20, ...overrides };
}

describe('listing query (SPEC §7.2)', () => {
  it('only ever lists active products, within the category and search', () => {
    expect(baseMatch(criteria({ categoryId: cement, q: 'ppc' }))).toEqual({
      status: 'active',
      categoryPath: cement,
      $text: { $search: 'ppc' },
    });
  });

  it('combines every optional filter', () => {
    const match = filterMatch(
      criteria({ brandIds: [lucky], minPrice: 400, maxPrice: 1_500, values: { packSize: ['50 kg'] }, inStock: true }),
    );
    expect(match).toEqual({
      $and: [
        { brandId: { $in: [lucky] } },
        { maxPrice: { $gte: 400 } },
        { minPrice: { $lte: 1_500 } },
        { 'filters.packSize': { $in: ['50 kg'] } },
        { totalStock: { $gt: 0 } },
      ],
    });
  });

  it('leaves out the facet’s own filter, so its counts show the alternatives', () => {
    const withBrand = criteria({ brandIds: [lucky], values: { packSize: ['50 kg'] } });
    expect(filterMatch(withBrand, 'brand')).toEqual({ $and: [{ 'filters.packSize': { $in: ['50 kg'] } }] });
    expect(filterMatch(withBrand, 'packSize')).toEqual({ $and: [{ brandId: { $in: [lucky] } }] });
  });

  it('matches nothing for a brand filter that named no known brand', () => {
    expect(filterMatch(criteria({ brandIds: null }))).toEqual({ $and: [{ brandId: { $in: [] } }] });
  });

  it('has no filter stage at all when nothing is selected', () => {
    expect(filterMatch(criteria())).toEqual({});
  });

  it('sorts by relevance, price and date with a stable tie-breaker', () => {
    expect(sortStage(criteria({ q: 'cement' }))).toEqual({ score: { $meta: 'textScore' }, _id: 1 });
    expect(sortStage(criteria())).toEqual({ isFeatured: -1, createdAt: -1, _id: -1 });
    expect(sortStage(criteria({ sort: 'price_asc' }))).toEqual({ minPrice: 1, _id: 1 });
    expect(sortStage(criteria({ sort: 'newest' }))).toEqual({ createdAt: -1, _id: -1 });
  });

  it('pages the results inside the facet', () => {
    const [first, facet] = listingPipeline(criteria({ page: 3, pageSize: 10 }));
    expect(first).toEqual({ $match: { status: 'active' } });
    if (!facet || !('$facet' in facet)) throw new Error('expected a $facet stage');
    const results = facet.$facet.results;
    expect(results).toContainEqual({ $skip: 20 });
    expect(results).toContainEqual({ $limit: 10 });
  });
});
