import type { PageMeta } from '@aricon/shared';
import { SetMetadata } from '@nestjs/common';

/**
 * A page of results. Return it from a controller and the response becomes
 * `{ data: [...], meta: { page, pageSize, total } }` (CLAUDE.md §10). `extra` adds top-level
 * siblings the spec defines for a list, e.g. `facets` on `GET /api/products`.
 */
export class Paginated<T> {
  constructor(
    readonly data: T[],
    readonly meta: PageMeta,
    readonly extra: Readonly<Record<string, unknown>> = {},
  ) {}
}

export const RAW_RESPONSE = 'aricon:raw-response';

/**
 * Opt a handler (or controller) out of the `{ data }` envelope — for responses whose shape the
 * spec fixes, like `GET /api/health`, and for file downloads.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true);
