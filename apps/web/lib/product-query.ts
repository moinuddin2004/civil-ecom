import { DEFAULT_PAGE_SIZE, productListQuery, type FilterKey, type ProductListQuery } from '@aricon/shared';

/**
 * Product list query strings (SPEC §7.2 `GET /api/products`). Storefront URLs use the same
 * parameters as the API (`?brand=lucky,dg-khan&inStock=true&sort=price_asc&page=2`), so a listing
 * page can pass its validated search params straight through.
 */

/** Keys in a fixed order, so equal queries give equal strings (and share one cache entry). */
const LIST_KEYS = [
  'category',
  'brand',
  'q',
  'minPrice',
  'maxPrice',
  'type',
  'packSize',
  'grade',
  'colour',
  'size',
  'inStock',
  'sort',
  'page',
  'pageSize',
] as const satisfies readonly (keyof ProductListQuery)[];

type ListKey = (typeof LIST_KEYS)[number];

/** What a page receives as `searchParams` (after `await`), or a URLSearchParams in the browser. */
export type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | URLSearchParams
  | { get(name: string): string | null };

function readParam(input: SearchParamsInput, key: string): string | undefined {
  if (typeof (input as { get?: unknown }).get === 'function') {
    return (input as { get(name: string): string | null }).get(key) ?? undefined;
  }
  const value = (input as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Validates listing search params with the shared `productListQuery` schema. A bad or unknown
 * parameter (`?page=abc`, `?utm_source=…`) is dropped instead of failing the whole page.
 * Category and brand pages set `category` / `brand` from the path themselves.
 */
export function parseProductSearchParams(input: SearchParamsInput): ProductListQuery {
  const clean: Partial<Record<ListKey, string>> = {};
  for (const key of LIST_KEYS) {
    const value = readParam(input, key)?.trim();
    if (!value) continue;
    if (productListQuery.shape[key].safeParse(value).success) clean[key] = value;
  }
  const parsed = productListQuery.safeParse(clean);
  return parsed.success ? parsed.data : productListQuery.parse({});
}

/**
 * Query string (without `?`) for the API or a storefront link. Lists are comma-joined; page 1 and
 * the default page size are left out.
 */
export function buildProductQuery(query: Partial<ProductListQuery>): string {
  const params = new URLSearchParams();
  for (const key of LIST_KEYS) {
    const value = query[key];
    if (value === undefined || value === '') continue;
    if (key === 'page' && value === 1) continue;
    if (key === 'pageSize' && value === DEFAULT_PAGE_SIZE) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','));
    } else if (typeof value === 'boolean') {
      params.set(key, value ? 'true' : 'false');
    } else {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

/** `${basePath}?${buildProductQuery(query)}`, or `basePath` alone when there is no query to add. */
export function buildListingHref(basePath: string, query: Partial<ProductListQuery>): string {
  const qs = buildProductQuery(query);
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Drops `page` from a query — every filter/sort change goes back to page 1. */
export function withoutPage(query: Partial<ProductListQuery>): Partial<ProductListQuery> {
  const { page: _page, ...rest } = query;
  return rest;
}

/** `query` with one facet filter's selected values replaced (a facet checkbox toggled). */
export function withFilterValues(
  query: Partial<ProductListQuery>,
  key: FilterKey,
  values: string[],
): Partial<ProductListQuery> {
  return { ...query, [key]: values };
}

/**
 * True when the listing is not the plain first page: search text, a filter, a sort or page > 1.
 * SPEC §8.1: only the plain first page of a category or brand is served from ISR. Pass the parsed
 * search params before adding the path's category or brand.
 */
export function hasListFilters(query: Partial<ProductListQuery>): boolean {
  return (
    Boolean(query.q) ||
    query.minPrice !== undefined ||
    query.maxPrice !== undefined ||
    (query.brand?.length ?? 0) > 0 ||
    (query.type?.length ?? 0) > 0 ||
    (query.packSize?.length ?? 0) > 0 ||
    (query.grade?.length ?? 0) > 0 ||
    (query.colour?.length ?? 0) > 0 ||
    (query.size?.length ?? 0) > 0 ||
    query.inStock !== undefined ||
    query.sort !== undefined ||
    (query.page ?? 1) > 1 ||
    (query.pageSize ?? DEFAULT_PAGE_SIZE) !== DEFAULT_PAGE_SIZE
  );
}
