import 'server-only';
import {
  ADMIN_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  isValidSlug,
  ORDER_NUMBER_PATTERN,
  PAGE_SLUGS,
  type AddressDTO,
  type AdminMeDTO,
  type ApiListResponse,
  type ApiResponse,
  type BrandDTO,
  type CategoryNode,
  type CategoryPageDTO,
  type CustomerDTO,
  type CustomerOrderDTO,
  type CustomerOrderListItemDTO,
  type DeliveryAreaDTO,
  type HomeDTO,
  type PageDTO,
  type PageKey,
  type ProductCard,
  type ProductDetail,
  type ProductListQuery,
  type ProductListResponse,
  type PublicSettingsDTO,
} from '@aricon/shared';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { ApiError, isApiError, isNotFoundError, networkError } from './api-errors';
import { apiPath, readApiResponse, type HttpMethod } from './api-response';
import { CACHE_TAGS, CATALOG_REVALIDATE, PAGES_REVALIDATE } from './cache-tags';
import { getServerEnv } from './env';
import { buildProductQuery } from './product-query';
import { routes } from './routes';

export { buildProductQuery, hasListFilters, parseProductSearchParams } from './product-query';

/**
 * Server-side API access for Server Components, route handlers and Server Actions (SPEC §3.1):
 * calls Express at `INTERNAL_API_URL` directly (same VPS), never through the public domain.
 *
 * Two kinds of request:
 * - **Catalog** reads are cached in the Next.js data cache with a revalidate window and tags, and
 *   never carry cookies, so one visitor's data can't end up in a page served to everyone.
 * - **Session** reads (`no-store`) forward the visitor's `cookie` header, so the API sees their
 *   customer or admin session. They make the page dynamic.
 *
 * Set-Cookie headers from the API are not passed back to the browser: log in, log out and
 * anything else that changes the session must be called from the browser (`apiClient`).
 */

const REQUEST_TIMEOUT_MS = 10_000;

export interface ApiServerInit {
  method?: HttpMethod;
  /** Sent as JSON. */
  body?: unknown;
  /** `no-store` (the default without `revalidate`/`tags`) or `force-cache`. */
  cache?: 'no-store' | 'force-cache';
  /** Seconds in the data cache (`false` = until a tag is revalidated). Implies caching. */
  revalidate?: number | false;
  /** Data-cache tags from `CACHE_TAGS`. Implies caching. */
  tags?: string[];
  /** Forward the incoming `cookie` header. Default: true for no-store requests, false for cached ones. */
  forwardCookies?: boolean;
  /** Extra request headers, e.g. `Idempotency-Key`. */
  headers?: Record<string, string>;
}

/** fetch() rejects with a TypeError on network failure and a TimeoutError/AbortError on abort. */
function isFetchFailure(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'))
  );
}

/**
 * Calls the API and returns the parsed JSON envelope typed as `T` (e.g. `ApiResponse<HomeDTO>`).
 * Throws `ApiError` for error responses (404 → code `NOT_FOUND`, so pages can call `notFound()`)
 * and for network failures (status 0).
 */
export async function apiServer<T>(path: string, init: ApiServerInit = {}): Promise<T> {
  const env = getServerEnv();
  const method = init.method ?? 'GET';
  const cached =
    method === 'GET' &&
    init.cache !== 'no-store' &&
    (init.cache === 'force-cache' || init.revalidate !== undefined || (init.tags?.length ?? 0) > 0);
  const forwardCookies = init.forwardCookies ?? !cached;
  if (cached && forwardCookies) {
    throw new Error(`apiServer(${path}): a cached request must not forward cookies.`);
  }

  const requestHeaders = new Headers(init.headers);
  requestHeaders.set('Accept', 'application/json');
  if (init.body !== undefined) requestHeaders.set('Content-Type', 'application/json');
  // The API's Origin check (SPEC §7.1) applies to every state-changing request, ours included.
  if (method !== 'GET') requestHeaders.set('Origin', env.NEXT_PUBLIC_SITE_URL);
  if (forwardCookies) {
    const cookie = (await headers()).get('cookie');
    if (cookie) requestHeaders.set('Cookie', cookie);
  }

  const requestInit: RequestInit = {
    method,
    headers: requestHeaders,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
  if (cached) {
    const revalidate =
      init.revalidate ?? (init.cache === 'force-cache' ? undefined : CATALOG_REVALIDATE);
    requestInit.next = {
      ...(revalidate !== undefined ? { revalidate } : {}),
      ...(init.tags && init.tags.length > 0 ? { tags: init.tags } : {}),
    };
    if (init.cache === 'force-cache') requestInit.cache = 'force-cache';
  } else {
    requestInit.cache = 'no-store';
  }

  let response: Response;
  try {
    response = await fetch(`${env.INTERNAL_API_URL}${apiPath(path)}`, requestInit);
  } catch (error) {
    // Anything else (e.g. Next.js's dynamic-rendering signal for a no-store fetch during a static
    // render) must reach Next.js unchanged.
    if (isFetchFailure(error)) throw networkError(error);
    throw error;
  }
  return readApiResponse<T>(response);
}

/** `apiServer()` for `{ data }` endpoints: returns `data`. */
async function getData<T>(path: string, init: ApiServerInit): Promise<T> {
  const response = await apiServer<ApiResponse<T>>(path, init);
  return response.data;
}

function catalog(tags: string[], revalidate: number = CATALOG_REVALIDATE): ApiServerInit {
  return { revalidate, tags };
}

/**
 * Runs `load` for a well-formed slug. A slug the API could never match is a 404 without a request
 * (and without a cache entry). Rejects instead of throwing, so `orNotFound()` sees it.
 */
function withSlug<T>(slug: string, load: (slug: string) => Promise<T>): Promise<T> {
  return isValidSlug(slug)
    ? load(slug)
    : Promise.reject(new ApiError('NOT_FOUND', 404, "We couldn't find that page."));
}

/**
 * Awaits `promise` and turns a 404 from the API into the page's not-found screen.
 *
 * @example const product = await orNotFound(getProduct(slug));
 */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (isNotFoundError(error)) notFound();
    throw error;
  }
}

/**
 * True while `next build` prerenders pages (in CI, where the API isn't running). Pages that are
 * prerendered at build time can use it to render an empty state instead of failing the build.
 */
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/* Catalog (cached, tagged). Wrapped in React `cache()` so generateMetadata and the page share one
 * call per request. */

export const getHome = cache(
  (): Promise<HomeDTO> => getData<HomeDTO>('/api/home', catalog([CACHE_TAGS.home, CACHE_TAGS.catalog])),
);

/** Category tree with counts of active products. */
export const getCategories = cache(
  (): Promise<CategoryNode[]> => getData<CategoryNode[]>('/api/categories', catalog([CACHE_TAGS.catalog])),
);

export const getCategory = cache(
  (slug: string): Promise<CategoryPageDTO> =>
    withSlug(slug, (valid) =>
      getData<CategoryPageDTO>(
        `/api/categories/${valid}`,
        catalog([CACHE_TAGS.category(valid), CACHE_TAGS.catalog]),
      ),
    ),
);

export const getBrands = cache(
  (): Promise<BrandDTO[]> => getData<BrandDTO[]>('/api/brands', catalog([CACHE_TAGS.catalog])),
);

/** One active brand, from the brand list (there is no single-brand endpoint). Throws NOT_FOUND. */
export const getBrand = cache(async (slug: string): Promise<BrandDTO> => {
  const brand = (await getBrands()).find((item) => item.slug === slug);
  if (!brand) throw new ApiError('NOT_FOUND', 404, "We couldn't find that brand.");
  return brand;
});

const fetchProducts = cache(
  (queryString: string, cached: boolean, tagList: string): Promise<ProductListResponse> =>
    apiServer<ProductListResponse>(
      `/api/products${queryString ? `?${queryString}` : ''}`,
      cached ? catalog(tagList.split('\n')) : { cache: 'no-store', forwardCookies: false },
    ),
);

export interface GetProductsOptions {
  /**
   * Keep the result in the data cache. Default: yes, unless the query has search text (free text
   * would fill the cache with one entry per search).
   */
  cached?: boolean;
}

/** `GET /api/products`: product cards, `meta` and `facets` for a listing. */
export function getProducts(
  query: Partial<ProductListQuery> = {},
  options: GetProductsOptions = {},
): Promise<ProductListResponse> {
  const tags: string[] = [CACHE_TAGS.catalog];
  if (query.category) tags.push(CACHE_TAGS.category(query.category));
  for (const brand of query.brand ?? []) tags.push(CACHE_TAGS.brand(brand));
  return fetchProducts(buildProductQuery(query), options.cached ?? !query.q, tags.join('\n'));
}

export const getProduct = cache(
  (slug: string): Promise<ProductDetail> =>
    withSlug(slug, (valid) =>
      getData<ProductDetail>(
        `/api/products/${valid}`,
        catalog([CACHE_TAGS.product(valid), CACHE_TAGS.catalog]),
      ),
    ),
);

/** Up to 8 related products (SPEC §7.2). */
export const getRelated = cache(
  (slug: string): Promise<ProductCard[]> =>
    withSlug(slug, (valid) =>
      getData<ProductCard[]>(
        `/api/products/${valid}/related`,
        catalog([CACHE_TAGS.product(valid), CACHE_TAGS.catalog]),
      ),
    ),
);

export const getDeliveryAreas = cache(
  (): Promise<DeliveryAreaDTO[]> =>
    getData<DeliveryAreaDTO[]>('/api/delivery-areas', catalog([CACHE_TAGS.deliveryAreas])),
);

/** Store contact, WhatsApp, payment methods and bank accounts (footer, checkout). */
export const getPublicSettings = cache(
  (): Promise<PublicSettingsDTO> =>
    getData<PublicSettingsDTO>('/api/settings/public', catalog([CACHE_TAGS.settings])),
);

/** Content page by key; the API path uses the URL form (`refundPolicy` → `/api/pages/refund-policy`). */
export const getPage = cache(
  (key: PageKey): Promise<PageDTO> =>
    getData<PageDTO>(`/api/pages/${PAGE_SLUGS[key]}`, catalog([CACHE_TAGS.pages], PAGES_REVALIDATE)),
);

/* Session-bound (no-store, cookies forwarded). Each call makes the page dynamic. */

function isSignedOut(error: unknown): boolean {
  return isApiError(error) && (error.status === 401 || error.status === 403);
}

/** The logged-in customer, or null (no session, expired, blocked). */
export const getCurrentCustomer = cache(async (): Promise<CustomerDTO | null> => {
  // No session cookie → no request. Read outside the try: Next.js signals dynamic rendering by throwing.
  const cookieStore = await cookies();
  if (!cookieStore.has(CUSTOMER_SESSION_COOKIE)) return null;
  try {
    return await getData<CustomerDTO>('/api/auth/me', {});
  } catch (error) {
    if (isSignedOut(error)) return null;
    throw error;
  }
});

/** The logged-in customer, or a redirect to log in and come back to `nextPath`. */
export async function requireCustomer(nextPath: string): Promise<CustomerDTO> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect(routes.login(nextPath));
  return customer;
}

/** The logged-in staff member with effective permissions, or null. */
export const getAdminMe = cache(async (): Promise<AdminMeDTO | null> => {
  const cookieStore = await cookies();
  if (!cookieStore.has(ADMIN_SESSION_COOKIE)) return null;
  try {
    return await getData<AdminMeDTO>('/api/admin/auth/me', {});
  } catch (error) {
    if (isSignedOut(error)) return null;
    throw error;
  }
});

/** The signed-in customer's saved addresses (call after `requireCustomer()`). */
export const getAddresses = cache(
  (): Promise<AddressDTO[]> => getData<AddressDTO[]>('/api/account/addresses', {}),
);

/** The signed-in customer's orders, newest first. */
export const getCustomerOrders = cache(
  (page = 1, pageSize = 20): Promise<ApiListResponse<CustomerOrderListItemDTO>> =>
    apiServer<ApiListResponse<CustomerOrderListItemDTO>>(`/api/orders?page=${page}&pageSize=${pageSize}`, {}),
);

/** One of the signed-in customer's orders; another customer's order is a 404 like an unknown one. */
export const getCustomerOrder = cache(
  (orderNumber: string): Promise<CustomerOrderDTO> =>
    ORDER_NUMBER_PATTERN.test(orderNumber)
      ? getData<CustomerOrderDTO>(`/api/orders/${encodeURIComponent(orderNumber)}`, {})
      : Promise.reject(new ApiError('NOT_FOUND', 404, "We couldn't find that order.")),
);
