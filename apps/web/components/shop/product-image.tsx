import Image from 'next/image';
import { productImageSrc } from '@/lib/images';
import { cn } from '@/lib/utils';
import { CategoryGlyph } from './category-glyph';

export interface ProductImageProps {
  /** Product image prefix (`products/{id}/{imageId}`), or null for the placeholder. */
  imageKey: string | null;
  alt: string;
  /** next/image `sizes`; the custom loader picks the 300/800/1600 file from it. */
  sizes: string;
  /** Category slug or name (or the product name) that picks the placeholder icon. */
  placeholderHint: string;
  /** Placeholder icon size in px at the base breakpoint. */
  placeholderSize: number;
  /** Extra classes for the placeholder icon, e.g. `lg:size-[88px]`. */
  placeholderClassName?: string;
  className?: string;
  /** The page's main picture (above the fold): loaded right away instead of lazily. */
  preload?: boolean;
}

/**
 * A product photo filling its (relative, sized) parent with `object-contain`, or the category icon
 * in concrete-400 when there is no photo (v2 §1.12, §1.26).
 */
export function ProductImage({
  imageKey,
  alt,
  sizes,
  placeholderHint,
  placeholderSize,
  placeholderClassName,
  className,
  preload,
}: ProductImageProps) {
  if (!imageKey) {
    return (
      <CategoryGlyph
        hint={placeholderHint}
        size={placeholderSize}
        className={cn('text-concrete-400', placeholderClassName)}
      />
    );
  }
  return (
    <Image
      src={productImageSrc(imageKey)}
      alt={alt}
      fill
      sizes={sizes}
      preload={preload}
      className={cn('object-contain', className)}
    />
  );
}
