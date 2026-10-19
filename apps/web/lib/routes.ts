import { PAGE_SLUGS, type PageKey } from '@aricon/shared';

/**
 * Storefront and account URLs (SPEC §8.1, §9) in one place, so links, canonical URLs, the
 * sitemap and redirects agree. Slugs and order numbers are URL-safe already; `next` and search
 * text are encoded.
 */

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/** Only same-site paths are allowed as a post-login target (no `//evil.com` or absolute URLs). */
export function safeNextPath(next: string | null | undefined, fallback = '/account'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}

export const routes = {
  home: '/',
  product: (slug: string) => `/product/${slug}`,
  category: (slug: string) => `/category/${slug}`,
  brand: (slug: string) => `/brand/${slug}`,
  search: (q?: string) => withQuery('/search', { q }),
  page: (key: PageKey) => `/pages/${PAGE_SLUGS[key]}`,
  cart: '/cart',
  checkout: '/checkout',
  checkoutSuccess: (orderNumber: string) => `/checkout/success/${orderNumber}`,
  login: (next?: string) => withQuery('/login', { next }),
  signup: (next?: string) => withQuery('/signup', { next }),
  forgotPassword: '/forgot-password',
  account: '/account',
  accountOrders: '/account/orders',
  accountOrder: (orderNumber: string) => `/account/orders/${orderNumber}`,
  accountAddresses: '/account/addresses',
  accountProfile: '/account/profile',
  admin: '/admin',
  adminLogin: (next?: string) => withQuery('/admin/login', { next }),
  adminChangePassword: '/admin/change-password',
} as const;
