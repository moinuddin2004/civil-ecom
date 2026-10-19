import type { FilterKey, Unit, VariantOptionKey } from '../enums.js';
import type { BulkTier } from '../pricing.js';

/**
 * Public catalog responses (SPEC §7.2). Dates are ISO strings in JSON. Image keys are turned into
 * URLs by the web app with `imageUrl()`.
 */

/** SPEC §7.2 `ProductCard`, plus `lowStockCount` for the "Only 4 left" badge in the v2 card. */
export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  unit: Unit;
  /** Product image prefix (first image), or null. */
  imageKey: string | null;
  minPrice: number;
  maxPrice: number;
  /** MRP of the variant with the lowest price (for "Save 3%"). */
  mrpOfMin: number;
  /** Lowest bulk tier price across active variants, or null when there are no tiers. */
  lowestTierPrice: number | null;
  inStock: boolean;
  variantCount: number;
  defaultVariantId: string;
  /** Stock of the default variant when it is at or below its low-stock threshold (and above 0). */
  lowStockCount: number | null;
}

export interface ProductVariantDTO {
  id: string;
  sku: string;
  label: string;
  options: Partial<Record<VariantOptionKey, string>>;
  mrp: number;
  price: number;
  bulkTiers: BulkTier[];
  stock: number;
  lowStockThreshold: number;
}

export interface BreadcrumbDTO {
  name: string;
  slug: string;
}

export interface ProductImageDTO {
  id: string;
  key: string;
  alt: string;
}

/** `GET /api/products/:slug` — active variants only. */
export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  brand: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  /** Parent (if any) then the category itself. */
  breadcrumbs: BreadcrumbDTO[];
  type: string | null;
  unit: Unit;
  description: string;
  specifications: { label: string; value: string }[];
  images: ProductImageDTO[];
  variants: ProductVariantDTO[];
  /** Option keys that vary between variants, in display order (variant chips). */
  optionKeys: VariantOptionKey[];
  minPrice: number;
  maxPrice: number;
  seo: { title: string | null; description: string | null };
  updatedAt: string;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface BrandFacet {
  id: string;
  name: string;
  slug: string;
  count: number;
}

/** Counts for the current result set, each ignoring its own filter (SPEC §7.2). */
export interface ProductFacets {
  brands: BrandFacet[];
  price: { min: number; max: number } | null;
  values: Record<FilterKey, FacetValue[]>;
}

export interface ProductListResponse {
  data: ProductCard[];
  meta: { page: number; pageSize: number; total: number };
  facets: ProductFacets;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageKey: string | null;
  /** Active products in this category and its children. */
  productCount: number;
  children: CategoryNode[];
}

/** `GET /api/categories/:slug`. */
export interface CategoryPageDTO {
  category: CategoryNode;
  parent: { id: string; name: string; slug: string } | null;
  /** Siblings' parent's children when this is a sub-category; own children otherwise. */
  children: CategoryNode[];
  breadcrumbs: BreadcrumbDTO[];
}

export interface BrandDTO {
  id: string;
  name: string;
  slug: string;
  logoKey: string | null;
}

export interface BannerDTO {
  id: string;
  desktopKey: string;
  mobileKey: string | null;
  alt: string;
  link: string | null;
}

export interface CategoryTileDTO {
  id: string;
  name: string;
  slug: string;
  imageKey: string | null;
  productCount: number;
}

/** `GET /api/home`. Empty sections are empty arrays; the UI skips them. */
export interface HomeDTO {
  banners: BannerDTO[];
  categoryTiles: CategoryTileDTO[];
  featured: ProductCard[];
  deals: ProductCard[];
  newArrivals: ProductCard[];
  brands: BrandDTO[];
}

/** `GET /api/search/suggest?q=`. */
export interface SearchSuggestDTO {
  products: { id: string; slug: string; name: string; brandName: string; imageKey: string | null; minPrice: number; unit: Unit }[];
  categories: { name: string; slug: string }[];
  brands: { name: string; slug: string }[];
}

/** `GET /api/delivery-areas`. `deliveryFee` is the effective fee (area fee or the default). */
export interface DeliveryAreaDTO {
  id: string;
  name: string;
  city: string;
  isServiceable: boolean;
  deliveryFee: number;
  freeDeliveryAbove: number | null;
}

export interface BankAccountDTO {
  id: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string | null;
  raastId: string | null;
}

/** `GET /api/settings/public`. */
export interface PublicSettingsDTO {
  storeName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  paymentMethods: { cod: boolean; bankTransfer: boolean };
  codMaxOrderAmount: number | null;
  defaultDeliveryFee: number;
  bankAccounts: BankAccountDTO[];
  /** Markdown. */
  bankTransferInstructions: string;
}

/** `GET /api/pages/:key`. */
export interface PageDTO {
  key: string;
  title: string;
  /** Markdown. */
  body: string;
}
