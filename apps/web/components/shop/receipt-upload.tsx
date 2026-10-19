'use client';

import { RECEIPT_MIME_TYPES, RECEIPT_UPLOAD_MAX_BYTES, formatFileSize } from '@aricon/shared';
import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { upload } from '@/lib/api-client';
import { errorMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { CARD_CLASS, iconProps } from './styles';

/**
 * Bank-transfer receipt upload (SPEC §6.8): `POST /api/orders/:orderNumber/receipts`, multipart
 * `file`, jpg/png/webp/pdf up to 5 MB. Checked here only to save a wasted upload — the API checks
 * the real file type and size. Refreshes the page so the receipt list and payment status update.
 */
export function ReceiptUpload({ orderNumber, className }: { orderNumber: string; className?: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!(RECEIPT_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Choose a photo (JPG, PNG, WebP) or a PDF of the receipt.');
      return;
    }
    if (file.size > RECEIPT_UPLOAD_MAX_BYTES) {
      toast.error(`The file is too large. Choose one under ${formatFileSize(RECEIPT_UPLOAD_MAX_BYTES)}.`);
      return;
    }

    setProgress(0);
    try {
      await upload(`/orders/${encodeURIComponent(orderNumber)}/receipts`, file, 'file', setProgress);
      toast.success('Receipt uploaded. We verify receipts within one business day.');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't upload the receipt. Please try again."));
    } finally {
      setProgress(null);
    }
  }

  const uploading = progress !== null;
  return (
    <div className={cn(CARD_CLASS, 'flex flex-col gap-3 p-4 text-left', className)}>
      <p className="font-medium text-ink">Upload receipt</p>
      <p className="text-sm text-ink-700">After you transfer, upload a photo or PDF of the receipt so we can confirm your order.</p>
      <label
        className={cn(
          'flex h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-concrete-400 text-sm font-medium text-ink-700',
          uploading ? 'cursor-progress opacity-70' : 'cursor-pointer hover:border-ink',
        )}
      >
        <Upload {...iconProps} className="size-4.5" />
        {uploading ? `Uploading… ${Math.round((progress ?? 0) * 100)}%` : 'Take photo or choose file'}
        <input
          type="file"
          accept={RECEIPT_MIME_TYPES.join(',')}
          className="sr-only"
          disabled={uploading}
          onChange={(event) => void handleFile(event)}
        />
      </label>
    </div>
  );
}
