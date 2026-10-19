'use client';

import { IMAGE_MIME_TYPES, IMAGE_UPLOAD_MAX_BYTES, MAX_PRODUCT_IMAGES, formatFileSize, type ApiResponse } from '@aricon/shared';
import { ArrowLeft, ArrowRight, Star, Trash2, UploadCloud } from 'lucide-react';
import { useState, type ChangeEvent, type DragEvent } from 'react';
import { toast } from 'sonner';
import { ProductImage } from '@/components/shop/product-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { upload } from '@/lib/api-client';
import { errorMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';

export interface ProductImageValue {
  key: string;
  alt: string;
}

export interface ProductImagesEditorProps {
  images: ProductImageValue[];
  onChange: (images: ProductImageValue[]) => void;
  /** The saved product's id, or the id a new product's first photo was uploaded under. */
  productId: string | undefined;
  /** A new product: the id the API made for the first photo, to create the product with. */
  onProductId: (id: string) => void;
  productName: string;
  disabled?: boolean;
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/**
 * Product photos (SPEC §10.5, §12.2): each file is uploaded straight away
 * (`POST /api/admin/uploads/product-image`, stored as 300/800/1600 px WebP) and kept in the form;
 * "Save changes" attaches them. The first photo is the main one.
 */
export function ProductImagesEditor({ images, onChange, productId, onProductId, productName, disabled }: ProductImagesEditorProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const uploading = progress !== null;
  const full = images.length >= MAX_PRODUCT_IMAGES;

  async function add(files: readonly File[]) {
    let owner = productId;
    let list = images;
    for (const file of files.slice(0, MAX_PRODUCT_IMAGES - list.length)) {
      if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: choose a JPG, PNG or WebP image.`);
        continue;
      }
      if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
        toast.error(`${file.name}: choose a photo under ${formatFileSize(IMAGE_UPLOAD_MAX_BYTES)}.`);
        continue;
      }
      setProgress(0);
      try {
        const { data } = await upload<ApiResponse<{ key: string; productId: string }>>('/admin/uploads/product-image', file, 'file', setProgress, {
          fields: owner ? { productId: owner } : {},
        });
        if (!owner) {
          owner = data.productId;
          onProductId(owner);
        }
        list = [...list, { key: data.key, alt: '' }];
        onChange(list);
      } catch (error) {
        toast.error(`${file.name}: ${errorMessage(error, "the photo couldn't be uploaded.")}`);
      }
    }
    setProgress(null);
  }

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void add(files);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (!disabled && !uploading && !full) void add(Array.from(event.dataTransfer.files));
  }

  const blocked = disabled || uploading || full;

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!blocked) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={drop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 text-center',
          dragOver ? 'border-blueprint bg-blueprint-50' : 'border-concrete-200',
          blocked && 'opacity-60',
        )}
      >
        <UploadCloud aria-hidden strokeWidth={1.75} className="size-8 text-cement" />
        {uploading ? (
          <p className="text-sm text-ink-700 tabular-nums">Uploading… {Math.round((progress ?? 0) * 100)}%</p>
        ) : full ? (
          <p className="text-sm text-ink-700">{MAX_PRODUCT_IMAGES} photos is the most a product can have.</p>
        ) : (
          <>
            <p className="text-sm text-ink-700">Drag photos here, or</p>
            <label className={cn('text-sm font-medium text-blueprint', blocked ? 'cursor-not-allowed' : 'cursor-pointer hover:underline')}>
              choose files
              <input type="file" accept={IMAGE_MIME_TYPES.join(',')} multiple className="sr-only" disabled={blocked} onChange={pick} />
            </label>
          </>
        )}
        <p className="text-xs text-cement">JPG, PNG or WebP, up to {formatFileSize(IMAGE_UPLOAD_MAX_BYTES)} each. The first photo is the main photo.</p>
      </div>

      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.key} className="flex flex-col gap-2 rounded-md border border-concrete-150 p-2">
              <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-concrete-50">
                <ProductImage imageKey={image.key} alt={image.alt || productName} sizes="200px" placeholderHint={productName} placeholderSize={32} />
                {index === 0 ? (
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-white">Main photo</span>
                ) : null}
              </span>
              <Input
                size="xs"
                aria-label={`Photo ${index + 1} description`}
                placeholder="Describe the photo"
                value={image.alt}
                maxLength={150}
                disabled={disabled}
                onChange={(event) => onChange(images.map((item, i) => (i === index ? { ...item, alt: event.target.value } : item)))}
              />
              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Move left" disabled={disabled || index === 0} onClick={() => onChange(move(images, index, index - 1))}>
                    <ArrowLeft aria-hidden strokeWidth={1.75} className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move right"
                    disabled={disabled || index === images.length - 1}
                    onClick={() => onChange(move(images, index, index + 1))}
                  >
                    <ArrowRight aria-hidden strokeWidth={1.75} className="size-4" />
                  </Button>
                  {index > 0 ? (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Make main photo" disabled={disabled} onClick={() => onChange(move(images, index, 0))}>
                      <Star aria-hidden strokeWidth={1.75} className="size-4" />
                    </Button>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="icon-sm"
                  aria-label="Remove photo"
                  disabled={disabled}
                  onClick={() => onChange(images.filter((_, i) => i !== index))}
                >
                  <Trash2 aria-hidden strokeWidth={1.75} className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
