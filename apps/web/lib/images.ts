import { PRODUCT_IMAGE_SRC_PREFIX, STATIC_IMAGE_SRC_PREFIX } from './image-loader';

/**
 * `src` values for `next/image`, understood by the custom loader in `image-loader.ts`. Components
 * never build an image URL themselves (SPEC §12.1 keys are prefixes/keys, not URLs).
 */

/** A product image: `imageKey` is the stored prefix (`products/{productId}/{imageId}`). */
export function productImageSrc(imageKey: string): string {
  return `${PRODUCT_IMAGE_SRC_PREFIX}${imageKey}`;
}

/** A fixed-size public image: banner, category tile image or brand logo (full file key). */
export function staticImageSrc(imageKey: string): string {
  return `${STATIC_IMAGE_SRC_PREFIX}${imageKey}`;
}
