import {
  VARIANT_OPTION_KEYS,
  type BannerDTO,
  type BrandFacet,
  type BreadcrumbDTO,
  type BrandDTO,
  type CategoryNode,
  type CategoryPageDTO,
  type CategoryTileDTO,
  type FacetValue,
  type FilterKey,
  type ProductCard,
  type ProductDetail,
  type ProductFacets,
  type SearchSuggestDTO,
  type VariantOptionKey,
} from '@aricon/shared';
import type { BrandLean } from '../../models/brand.model.js';
import type { CategoryLean } from '../../models/category.model.js';
import type { Banner } from '../../models/homepage.model.js';
import type { ProductLean, Variant } from '../../models/product.model.js';

/* Entity → API DTO mappers for the public catalog (SPEC §7.2). Only active data reaches them. */

type CardVariant = Pick<Variant, '_id' | 'mrp' | 'price' | 'bulkTiers' | 'stock' | 'lowStockThreshold' | 'isActive'>;

export interface CardSource {
  _id: ProductLean['_id'];
  slug: string;
  name: string;
  brandName: string;
  unit: ProductLean['unit'];
  images: { key: string }[];
  minPrice: number;
  maxPrice: number;
  variants: CardVariant[];
}

/**
 * SPEC §7.2 `ProductCard`. The default variant (added by the card's "Add" button) is the first
 * active variant in stock, else the first active one; "Only N left" uses its stock and threshold.
 */
export function toProductCard(product: CardSource): ProductCard {
  const active = product.variants.filter((variant) => variant.isActive);
  const cheapest = active.reduce<CardVariant | undefined>(
    (min, variant) => (!min || variant.price < min.price ? variant : min),
    undefined,
  );
  const defaultVariant = active.find((variant) => variant.stock > 0) ?? active[0];
  const tierPrices = active.flatMap((variant) => variant.bulkTiers.map((tier) => tier.price));
  const lowStock =
    defaultVariant && defaultVariant.stock > 0 && defaultVariant.stock <= defaultVariant.lowStockThreshold;

  return {
    id: String(product._id),
    slug: product.slug,
    name: product.name,
    brandName: product.brandName,
    unit: product.unit,
    imageKey: product.images[0]?.key ?? null,
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
    mrpOfMin: cheapest?.mrp ?? product.minPrice,
    lowestTierPrice: tierPrices.length > 0 ? Math.min(...tierPrices) : null,
    inStock: active.some((variant) => variant.stock > 0),
    variantCount: active.length,
    defaultVariantId: defaultVariant ? String(defaultVariant._id) : '',
    lowStockCount: lowStock ? defaultVariant.stock : null,
  };
}

/** Option keys that actually differ between the active variants, in display order (variant chips). */
export function varyingOptionKeys(variants: readonly Pick<Variant, 'options'>[]): VariantOptionKey[] {
  return VARIANT_OPTION_KEYS.filter((key) => {
    // `?.`: documents saved before the variant schema kept empty `options` have no field at all.
    const values = new Set(variants.map((variant) => variant.options?.[key]).filter(Boolean));
    return values.size > 1;
  });
}

export function breadcrumbsFor(category: Pick<CategoryLean, 'name' | 'slug'>, parent: Pick<CategoryLean, 'name' | 'slug'> | null): BreadcrumbDTO[] {
  const crumbs: BreadcrumbDTO[] = [];
  if (parent) crumbs.push({ name: parent.name, slug: parent.slug });
  crumbs.push({ name: category.name, slug: category.slug });
  return crumbs;
}

/** `GET /api/products/:slug` — active variants only. */
export function toProductDetail(
  product: ProductLean,
  brand: Pick<BrandLean, '_id' | 'name' | 'slug'>,
  category: Pick<CategoryLean, '_id' | 'name' | 'slug'>,
  parent: Pick<CategoryLean, 'name' | 'slug'> | null,
): ProductDetail {
  const variants = product.variants.filter((variant) => variant.isActive);
  return {
    id: String(product._id),
    slug: product.slug,
    name: product.name,
    brand: { id: String(brand._id), name: brand.name, slug: brand.slug },
    category: { id: String(category._id), name: category.name, slug: category.slug },
    breadcrumbs: breadcrumbsFor(category, parent),
    type: product.type ?? null,
    unit: product.unit,
    description: product.description,
    specifications: product.specifications.map(({ label, value }) => ({ label, value })),
    images: product.images.map((image) => ({ id: String(image._id), key: image.key, alt: image.alt })),
    variants: variants.map((variant) => ({
      id: String(variant._id),
      sku: variant.sku,
      label: variant.label,
      options: { ...variant.options },
      mrp: variant.mrp,
      price: variant.price,
      bulkTiers: variant.bulkTiers.map(({ minQty, price }) => ({ minQty, price })),
      stock: variant.stock,
      lowStockThreshold: variant.lowStockThreshold,
    })),
    optionKeys: varyingOptionKeys(variants),
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
    seo: { title: product.seo.title ?? null, description: product.seo.description ?? null },
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function toBrandDto(brand: Pick<BrandLean, '_id' | 'name' | 'slug' | 'logoKey'>): BrandDTO {
  return { id: String(brand._id), name: brand.name, slug: brand.slug, logoKey: brand.logoKey ?? null };
}

type CategoryCounts = ReadonlyMap<string, number>;

function toCategoryNode(category: CategoryLean, counts: CategoryCounts, children: CategoryNode[] = []): CategoryNode {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    imageKey: category.imageKey ?? null,
    productCount: counts.get(String(category._id)) ?? 0,
    children,
  };
}

function childrenOf(parent: CategoryLean, categories: readonly CategoryLean[], counts: CategoryCounts): CategoryNode[] {
  return categories
    .filter((category) => category.parentId && String(category.parentId) === String(parent._id))
    .map((child) => toCategoryNode(child, counts));
}

/**
 * Builds the two-level tree with active-product counts (counts include sub-categories). A
 * sub-category whose parent is hidden is left out, like its parent.
 */
export function buildCategoryTree(categories: readonly CategoryLean[], counts: CategoryCounts): CategoryNode[] {
  return categories
    .filter((category) => !category.parentId)
    .map((parent) => toCategoryNode(parent, counts, childrenOf(parent, categories, counts)));
}

/**
 * `GET /api/categories/:slug`. `children` are the category's own sub-categories, or — for a
 * sub-category — its siblings (the parent's children), so the page can show the same chips.
 */
export function toCategoryPage(
  category: CategoryLean,
  parent: CategoryLean | null,
  activeCategories: readonly CategoryLean[],
  counts: CategoryCounts,
): CategoryPageDTO {
  const own = childrenOf(category, activeCategories, counts);
  return {
    category: toCategoryNode(category, counts, own),
    parent: parent ? { id: String(parent._id), name: parent.name, slug: parent.slug } : null,
    children: parent ? childrenOf(parent, activeCategories, counts) : own,
    breadcrumbs: breadcrumbsFor(category, parent),
  };
}

export function toCategoryTile(category: CategoryLean, counts: CategoryCounts): CategoryTileDTO {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    imageKey: category.imageKey ?? null,
    productCount: counts.get(String(category._id)) ?? 0,
  };
}

export function toBannerDto(banner: Banner): BannerDTO {
  return {
    id: String(banner._id),
    desktopKey: banner.desktopKey,
    mobileKey: banner.mobileKey ?? null,
    alt: banner.alt,
    link: banner.link ?? null,
  };
}

/** Fields a search suggestion needs (projection of a product). */
export type SuggestSource = Pick<ProductLean, '_id' | 'slug' | 'name' | 'brandName' | 'minPrice' | 'unit'> & {
  images: { key: string }[];
};

export function toSuggestProduct(product: SuggestSource): SearchSuggestDTO['products'][number] {
  return {
    id: String(product._id),
    slug: product.slug,
    name: product.name,
    brandName: product.brandName,
    imageKey: product.images[0]?.key ?? null,
    minPrice: product.minPrice,
    unit: product.unit,
  };
}

interface FacetSource {
  brands: readonly { _id: unknown; count: number }[];
  price: readonly { min: number; max: number }[];
  values: Readonly<Record<FilterKey, readonly { _id: string; count: number }[]>>;
}

/** Most products first; ties alphabetically. */
function byCountThenLabel<T extends { count: number }>(label: (item: T) => string) {
  return (a: T, b: T) => b.count - a.count || label(a).localeCompare(label(b));
}

/**
 * The `facets` of `GET /api/products`. Brand rows get their names from `brands` (rows for a brand
 * that is no longer active are dropped); value rows are sorted by count, then alphabetically.
 */
export function toProductFacets(source: FacetSource, brands: readonly BrandLean[]): ProductFacets {
  const brandById = new Map(brands.map((brand) => [String(brand._id), brand]));
  const brandFacets = source.brands.flatMap((row): BrandFacet[] => {
    const brand = brandById.get(String(row._id));
    return brand ? [{ id: String(brand._id), name: brand.name, slug: brand.slug, count: row.count }] : [];
  });

  const [price] = source.price;
  return {
    brands: brandFacets.sort(byCountThenLabel<BrandFacet>((item) => item.name)),
    price: price ? { min: price.min, max: price.max } : null,
    values: forEachFilterKey((key) =>
      source.values[key]
        .map((row): FacetValue => ({ value: row._id, count: row.count }))
        .sort(byCountThenLabel<FacetValue>((item) => item.value)),
    ),
  };
}

/** Builds a `Record<FilterKey, T>`; listing every key keeps it exhaustive without a cast. */
export function forEachFilterKey<T>(build: (key: FilterKey) => T): Record<FilterKey, T> {
  return {
    type: build('type'),
    packSize: build('packSize'),
    grade: build('grade'),
    colour: build('colour'),
    size: build('size'),
  };
}
