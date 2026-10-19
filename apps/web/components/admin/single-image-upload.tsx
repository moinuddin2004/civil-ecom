'use client';

import { IMAGE_MIME_TYPES, IMAGE_UPLOAD_MAX_BYTES, formatFileSize, type ApiResponse } from '@aricon/shared';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { upload } from '@/lib/api-client';
import { errorMessage } from '@/lib/api-errors';
import { staticImageSrc } from '@/lib/images';
import { cn } from '@/lib/utils';

export interface SingleImageUploadProps {
  label: string;
  /** Upload endpoint without `/api`, e.g. `/admin/uploads/category-image`. */
  endpoint: string;
  /** Multipart field naming the owner, e.g. `categoryId`. */
  ownerField: string;
  /** The saved record's id, or the id an earlier upload of a new record got. */
  ownerId: string | undefined;
  /** Current storage key, or null for none. */
  value: string | null;
  /** New key (null = removed) and the owner id the API used. */
  onChange: (key: string | null, ownerId: string | undefined) => void;
  /** Extra multipart fields (e.g. the banner `variant`). */
  fields?: Record<string, string>;
  /** Preview frame shape. */
  aspect?: 'square' | 'wide';
  hint?: string;
  disabled?: boolean;
  /** Hide "Remove" when an image is required (desktop banners). */
  required?: boolean;
}

/**
 * One public image for a record (category image, brand logo, banner): uploaded on choose through
 * the admin upload endpoint, previewed, and saved with the record's form.
 */
export function SingleImageUpload({
  label,
  endpoint,
  ownerField,
  ownerId,
  value,
  onChange,
  fields = {},
  aspect = 'square',
  hint,
  disabled,
  required,
}: SingleImageUploadProps) {
  const [progress, setProgress] = useState<number | null>(null);
  // Re-uploads keep the same key; a version in the preview URL shows the new file at once.
  const [version, setVersion] = useState(0);
  const uploading = progress !== null;

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
      toast.error(`Choose an image under ${formatFileSize(IMAGE_UPLOAD_MAX_BYTES)}.`);
      return;
    }
    setProgress(0);
    try {
      const { data } = await upload<ApiResponse<Record<string, string>>>(endpoint, file, 'file', setProgress, {
        fields: { ...fields, ...(ownerId ? { [ownerField]: ownerId } : {}) },
      });
      onChange(data.key ?? null, data[ownerField] ?? ownerId);
      setVersion(Date.now());
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't upload the image. Please try again."));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-concrete-150 bg-concrete-50 text-concrete-400',
            aspect === 'wide' ? 'h-16 w-40' : 'size-16',
          )}
        >
          {value ? (
            <Image src={staticImageSrc(version ? `${value}?v=${version}` : value)} alt="" fill sizes="160px" className="object-contain" />
          ) : (
            <ImageIcon aria-hidden strokeWidth={1.75} className="size-6" />
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <label
            className={cn(
              'flex h-9 items-center gap-2 rounded-md border border-concrete-400 px-3 text-sm font-medium text-ink',
              disabled || uploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-concrete-50',
            )}
          >
            <Upload aria-hidden strokeWidth={1.75} className="size-4" />
            {uploading ? `Uploading… ${Math.round((progress ?? 0) * 100)}%` : value ? 'Replace' : 'Upload image'}
            <input type="file" accept={IMAGE_MIME_TYPES.join(',')} className="sr-only" disabled={disabled || uploading} onChange={(event) => void choose(event)} />
          </label>
          {value && !required ? (
            <Button type="button" variant="destructive-ghost" size="sm" disabled={disabled || uploading} onClick={() => onChange(null, ownerId)}>
              <Trash2 aria-hidden strokeWidth={1.75} className="size-4" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      {hint ? <p className="text-xs text-cement">{hint}</p> : null}
    </div>
  );
}
