/**
 * Public configuration, inlined into the bundle at build time. `process.env.NEXT_PUBLIC_*` must be
 * read with literal names for Next.js to inline them.
 */
function publicUrl(name: string, value: string | undefined, developmentDefault: string): string {
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`${name} must be set when building for production (see apps/web/.env.example).`);
    }
    return developmentDefault;
  }
  return value.replace(/\/+$/, '');
}

export const siteUrl = publicUrl(
  'NEXT_PUBLIC_SITE_URL',
  process.env.NEXT_PUBLIC_SITE_URL,
  'http://localhost:3000',
);

/**
 * Base URL of public images (R2 custom domain in production, the API's dev-files route locally).
 * Safe in the browser: the next/image loader runs there.
 */
export const imageBaseUrl = publicUrl(
  'NEXT_PUBLIC_IMAGE_BASE_URL',
  process.env.NEXT_PUBLIC_IMAGE_BASE_URL,
  'http://localhost:3000/api/dev-files',
);

export const SITE_NAME = 'Aricon Shop';

/** `absoluteUrl('/product/ppc-cement')` → `https://shop.aricon.com.pk/product/ppc-cement`. */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
