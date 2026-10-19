/** Slugs and search helpers (SPEC §5 "Slugs"). */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 120;

/** "Cement & Plaster (50 kg)" → "cement-plaster-50-kg". */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

export function isValidSlug(value: string): boolean {
  return value.length <= SLUG_MAX && SLUG_PATTERN.test(value);
}

/** Escapes a string for use inside a RegExp (search input must never be raw regex, SPEC §16). */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits text around case-insensitive matches of `query`, for highlighting search suggestions. */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const pattern = new RegExp(`(${escapeRegExp(q)})`, 'ig');
  return text
    .split(pattern)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, match: part.toLowerCase() === q.toLowerCase() }));
}
