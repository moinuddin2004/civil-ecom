import { imageUrl, pickProductImageWidth } from '@aricon/shared';
import { imageBaseUrl } from './site';

/**
 * Custom `next/image` loader (SPEC §12.1, CLAUDE.md §22): images are pre-sized in Cloudflare R2
 * (300/800/1600 px webp), so the server never resizes anything at request time. Configured as
 * `images.loaderFile` in `next.config.ts`.
 *
 * `src` carries which of the two image shapes it is (see `lib/images.ts`):
 * - `product:{prefix}` — a product photo, stored at 3 widths; picks the smallest that covers the
 *   requested width.
 * - `static:{key}` — a banner, category image or brand logo: one fixed-size file, no `width` choice.
 */
export const PRODUCT_IMAGE_SRC_PREFIX = 'product:';
export const STATIC_IMAGE_SRC_PREFIX = 'static:';

interface AriconImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

export default function ariconImageLoader({ src, width }: AriconImageLoaderParams): string {
  if (src.startsWith(PRODUCT_IMAGE_SRC_PREFIX)) {
    const prefix = src.slice(PRODUCT_IMAGE_SRC_PREFIX.length);
    return imageUrl(imageBaseUrl, prefix, pickProductImageWidth(width));
  }
  if (src.startsWith(STATIC_IMAGE_SRC_PREFIX)) {
    return imageUrl(imageBaseUrl, src.slice(STATIC_IMAGE_SRC_PREFIX.length));
  }
  // Not one of ours (e.g. a local /public asset used directly with next/image): pass through.
  return src;
}
