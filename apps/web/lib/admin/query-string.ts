/**
 * Query-string helper for the admin list pages (orders, stock movements): server-rendered
 * `<Link>`s for tabs/filters/pagination, same zero-JS idiom as the storefront's
 * `lib/product-query.ts` but generic over whatever filter keys a given list uses.
 */
export function buildAdminHref(basePath: string, query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    if (key === 'page' && Number(value) <= 1) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
