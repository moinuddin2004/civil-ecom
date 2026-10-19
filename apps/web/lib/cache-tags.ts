import { CATALOG_REVALIDATE_SECONDS } from '@aricon/shared';

/**
 * Next.js data-cache tags (SPEC §14). Catalog fetches in `api-server.ts` are tagged with these, and
 * the API calls `POST /_internal/revalidate { tags }` with the same strings after a change:
 *
 * | Change in the API                       | Tags to send                                          |
 * |-----------------------------------------|-------------------------------------------------------|
 * | product details, prices, stock, status  | `product:{slug}` (old and new slug), `catalog`, `home` |
 * | category                                | `category:{slug}`, `catalog`, `home`                  |
 * | brand                                   | `brand:{slug}`, `catalog`, `home`                     |
 * | homepage                                | `home`                                                |
 * | settings (contact, payment, pages)      | `settings`, `pages`                                   |
 * | delivery areas                          | `delivery-areas`                                      |
 *
 * `catalog` covers every list (category tree, brands, product listings, related products), so one
 * product change refreshes the "In stock" badges everywhere. The names live in `@aricon/shared` so
 * the API sends exactly these strings.
 */
export { CACHE_TAGS } from '@aricon/shared';

/** Home, category, brand and product data (CLAUDE.md "Server constraints": ISR 300 s). */
export const CATALOG_REVALIDATE = CATALOG_REVALIDATE_SECONDS;

/** Content pages change rarely (SPEC §8.1: ISR 3600 s). */
export const PAGES_REVALIDATE = 3_600;
