
'use client';

import { useState } from 'react';
import { ProductImage } from './product-image';
import type { ProductDetail } from '@aricon/shared';

interface ProductImageGalleryProps {
  product: ProductDetail;
}

export function ProductImageGallery({
  product,
}: ProductImageGalleryProps) {
  const images = product.images;
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedImage = images[selectedIndex];

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image */}
      <div className="relative aspect-square overflow-hidden rounded-xl border border-concrete-150 bg-concrete-50">
        <div className="flex size-full items-center justify-center">
          <ProductImage
            imageKey={selectedImage?.key ?? null}
            alt={selectedImage?.alt ?? product.name}
            sizes="(min-width: 1024px) 640px, 100vw"
            placeholderHint={product.category.slug}
            placeholderSize={96}
            placeholderClassName="lg:size-[160px]"
            preload={selectedIndex === 0}
          />
        </div>
      </div>

      {/* Thumbnail Gallery */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={image.key ?? index}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`View product image ${index + 1}`}
              aria-pressed={selectedIndex === index}
              className={`
                relative size-20 shrink-0 overflow-hidden
                rounded-lg border-2 bg-concrete-50
                transition-all
                ${
                  selectedIndex === index
                    ? 'border-ink'
                    : 'border-concrete-150 hover:border-ink-400'
                }
              `}
            >
              <ProductImage
                imageKey={image.key ?? null}
                alt={image.alt ?? `${product.name} ${index + 1}`}
                sizes="80px"
                placeholderHint={product.category.slug}
                placeholderSize={32}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
