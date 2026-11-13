import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@aricon/shared';

/** The "rows per page" choices on admin lists (the API allows up to `MAX_PAGE_SIZE`). */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, MAX_PAGE_SIZE] as const;

/** `?pageSize=` as one of the offered sizes; anything else (or nothing) means "use the default". */
export function parsePageSize(raw: string | undefined): number | undefined {
  const size = Number(raw);
  return PAGE_SIZE_OPTIONS.some((option) => option === size) && size !== DEFAULT_PAGE_SIZE ? size : undefined;
}
