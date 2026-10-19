/**
 * Public image keys and URLs (SPEC §12.1). Product images are stored in three widths under one
 * prefix; the key saved on the product is that prefix, e.g. `products/{productId}/{imageId}`.
 * Banners, category images and brand logos store the full file key.
 */

export const PRODUCT_IMAGE_WIDTHS = [300, 800, 1600] as const;
export type ProductImageWidth = (typeof PRODUCT_IMAGE_WIDTHS)[number];

export function productImagePrefix(productId: string, imageId: string): string {
  return `products/${productId}/${imageId}`;
}

export function productImageFileKey(prefix: string, width: ProductImageWidth): string {
  return `${prefix}/${width}.webp`;
}

export function bannerImageKey(bannerId: string, variant: 'desktop' | 'mobile'): string {
  return `banners/${bannerId}/${variant}.webp`;
}

export function categoryImageKey(categoryId: string): string {
  return `categories/${categoryId}/image.webp`;
}

export function brandLogoKey(brandId: string): string {
  return `brands/${brandId}/logo.webp`;
}

export function receiptKey(orderId: string, receiptId: string, extension: 'jpg' | 'png' | 'webp' | 'pdf'): string {
  return `receipts/${orderId}/${receiptId}.${extension}`;
}

export function importFileKey(jobId: string): string {
  return `imports/${jobId}.xlsx`;
}

/** Smallest stored width that covers `requested` pixels (the Next.js image loader uses this). */
export function pickProductImageWidth(requested: number): ProductImageWidth {
  return PRODUCT_IMAGE_WIDTHS.find((width) => width >= requested) ?? 1600;
}

/**
 * Public URL of an image. With `width`, `key` is a product image prefix; without it, `key` is a
 * full file key.
 */
export function imageUrl(baseUrl: string, key: string, width?: ProductImageWidth): string {
  const base = baseUrl.replace(/\/+$/, '');
  return width ? `${base}/${productImageFileKey(key, width)}` : `${base}/${key}`;
}
