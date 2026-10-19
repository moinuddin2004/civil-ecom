import { MAX_RELATED_PRODUCTS, type ProductCard, type ProductDetail, type ProductFacets } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import type { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { Paginated } from '../../common/http/envelope.js';
import { forEachFilterKey, toProductCard, toProductDetail, toProductFacets } from './catalog.mappers.js';
import { BrandsRepository, CatalogProductsRepository, CategoriesRepository } from './catalog.repositories.js';
import type { ProductListQueryDto } from './dto/catalog.query.dto.js';
import type { ListingCriteria } from './listing-query.js';

const PRODUCT_NOT_FOUND = "We couldn't find that product.";

/** Product listing, detail and related products for the store (SPEC §7.2). Active data only. */
@Injectable()
export class ProductsService {
  constructor(
    private readonly products: CatalogProductsRepository,
    private readonly categories: CategoriesRepository,
    private readonly brands: BrandsRepository,
  ) {}

  /** `{ data: ProductCard[], meta, facets }`, from one `$facet` aggregation. */
  async list(query: ProductListQueryDto): Promise<Paginated<ProductCard>> {
    const criteria = await this.toCriteria(query);
    const result = await this.products.listing(criteria);
    const facetBrands = await this.brands.findActiveByIds(result.brands.map((row) => row._id));

    const facets: ProductFacets = toProductFacets(
      { brands: result.brands, price: result.price, values: forEachFilterKey((key) => result[key]) },
      facetBrands,
    );
    return new Paginated(
      result.results.map(toProductCard),
      { page: criteria.page, pageSize: criteria.pageSize, total: result.total[0]?.count ?? 0 },
      { facets },
    );
  }

  async detail(slug: string): Promise<ProductDetail> {
    const product = await this.products.findActiveBySlug(slug);
    if (!product) throw AppError.notFound(PRODUCT_NOT_FOUND);

    const [brand, category] = await Promise.all([
      this.brands.findById(String(product.brandId)),
      this.categories.findById(String(product.categoryId)),
    ]);
    const parent = category?.parentId ? await this.categories.findById(String(category.parentId)) : null;
    // An active product always has an active brand and category (they can't be hidden while they
    // have active products); if that ever breaks, answer 404 rather than half a page.
    if (!brand || !category) throw AppError.notFound(PRODUCT_NOT_FOUND);

    return toProductDetail(product, brand, category, parent);
  }

  /**
   * Up to 8 cards: the product's hand-picked `relatedProductIds` (active ones, in order), or — when
   * none are set or all are unavailable — other products from the same category.
   */
  async related(slug: string): Promise<ProductCard[]> {
    const product = await this.products.findActiveRelationsBySlug(slug);
    if (!product) throw AppError.notFound(PRODUCT_NOT_FOUND);

    const picked = await this.products.findActiveCardsByIds(product.relatedProductIds.slice(0, MAX_RELATED_PRODUCTS));
    const cards =
      picked.length > 0
        ? picked
        : await this.products.activeCardsInCategory(product.categoryId, product._id, MAX_RELATED_PRODUCTS);
    return cards.map(toProductCard);
  }

  /** Resolves slugs to ids. An unknown category is a 404; unknown brands just match nothing. */
  private async toCriteria(query: ProductListQueryDto): Promise<ListingCriteria> {
    let categoryId: Types.ObjectId | undefined;
    if (query.category) {
      const category = await this.categories.findActiveBySlug(query.category);
      if (!category) throw AppError.notFound("We couldn't find that category.");
      categoryId = category._id;
    }

    let brandIds: Types.ObjectId[] | null | undefined;
    if (query.brand) {
      const brands = await this.brands.findActiveBySlugs(query.brand);
      brandIds = brands.length > 0 ? brands.map((brand) => brand._id) : null;
    }

    return {
      categoryId,
      brandIds,
      q: query.q,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      values: { type: query.type, packSize: query.packSize, grade: query.grade, colour: query.colour, size: query.size },
      inStock: query.inStock,
      sort: query.sort ?? 'relevance',
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
