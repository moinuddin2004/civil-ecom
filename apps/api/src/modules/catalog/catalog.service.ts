import {
  NEW_ARRIVALS_COUNT,
  SUGGEST_BRANDS,
  SUGGEST_CATEGORIES,
  SUGGEST_MIN_QUERY,
  SUGGEST_PRODUCTS,
  type BrandDTO,
  type CategoryNode,
  type CategoryPageDTO,
  type HomeDTO,
  type SearchSuggestDTO,
} from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import {
  buildCategoryTree,
  toBannerDto,
  toBrandDto,
  toCategoryPage,
  toCategoryTile,
  toProductCard,
  toSuggestProduct,
} from './catalog.mappers.js';
import {
  BrandsRepository,
  CatalogProductsRepository,
  CategoriesRepository,
  HomepageRepository,
} from './catalog.repositories.js';

const EMPTY_SUGGESTIONS: SearchSuggestDTO = { products: [], categories: [], brands: [] };

/** Store navigation (SPEC §7.2): home, category tree and pages, brands, search suggestions. */
@Injectable()
export class CatalogService {
  constructor(
    private readonly categories: CategoriesRepository,
    private readonly brands: BrandsRepository,
    private readonly products: CatalogProductsRepository,
    private readonly homepage: HomepageRepository,
  ) {}

  async categoryTree(): Promise<CategoryNode[]> {
    const [categories, counts] = await Promise.all([
      this.categories.findActive(),
      this.products.activeCountsByCategory(),
    ]);
    return buildCategoryTree(categories, counts);
  }

  /** A sub-category whose parent is hidden is not reachable, same as in the tree. */
  async categoryPage(slug: string): Promise<CategoryPageDTO> {
    const [categories, counts] = await Promise.all([
      this.categories.findActive(),
      this.products.activeCountsByCategory(),
    ]);
    const category = categories.find((item) => item.slug === slug);
    const parent = category?.parentId
      ? categories.find((item) => String(item._id) === String(category.parentId))
      : null;
    if (!category || parent === undefined) throw AppError.notFound("We couldn't find that category.");
    return toCategoryPage(category, parent, categories, counts);
  }

  async brandList(): Promise<BrandDTO[]> {
    return (await this.brands.findActive()).map(toBrandDto);
  }

  /** Empty sections come back as empty arrays; the page skips them. */
  async home(): Promise<HomeDTO> {
    const home = await this.homepage.get();
    const [categories, counts, brands, featured, deals, newArrivals] = await Promise.all([
      this.categories.findActive(),
      this.products.activeCountsByCategory(),
      this.brands.findActive(),
      this.products.findActiveCardsByIds(home?.featuredProductIds ?? []),
      this.products.findActiveCardsByIds(home?.dealProductIds ?? []),
      this.products.latestActiveCards(NEW_ARRIVALS_COUNT),
    ]);

    return {
      banners: (home?.banners ?? [])
        .filter((banner) => banner.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(toBannerDto),
      categoryTiles: categories.filter((category) => category.showOnHome).map((category) => toCategoryTile(category, counts)),
      featured: featured.map(toProductCard),
      deals: deals.map(toProductCard),
      newArrivals: newArrivals.map(toProductCard),
      brands: brands.map(toBrandDto),
    };
  }

  /** Up to 6 products, 3 categories and 3 brands; fewer than 2 characters gives no suggestions. */
  async suggest(query: string | undefined): Promise<SearchSuggestDTO> {
    const text = query?.trim() ?? '';
    if (text.length < SUGGEST_MIN_QUERY) return EMPTY_SUGGESTIONS;

    const [products, categories, brands] = await Promise.all([
      this.products.suggest(text, SUGGEST_PRODUCTS),
      this.categories.searchActiveByName(text, SUGGEST_CATEGORIES),
      this.brands.searchActiveByName(text, SUGGEST_BRANDS),
    ]);
    return {
      products: products.map(toSuggestProduct),
      categories: categories.map(({ name, slug }) => ({ name, slug })),
      brands: brands.map(({ name, slug }) => ({ name, slug })),
    };
  }
}
