'use client';

import { Download } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { toast } from 'sonner';
import { apiDownload } from '@/lib/api-client';
import { errorMessage } from '@/lib/api-errors';
import { Button } from './button';

export interface DownloadButtonProps extends Omit<ComponentProps<typeof Button>, 'onClick' | 'loading' | 'type'> {
  /** API path without `/api`, e.g. `/orders/ARC-2026-000123/invoice`. */
  path: string;
  /** Used when the API doesn't name the file. */
  fileName: string;
}

/** Downloads a file from the API (invoice, Excel export) with a loading state; errors as a toast. */
export function DownloadButton({ path, fileName, children, ...props }: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      await apiDownload(path, fileName);
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't download the file. Please try again."));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button type="button" loading={downloading} onClick={() => void download()} {...props}>
      {props.size === 'icon' || props.size === 'icon-sm' ? null : <Download aria-hidden strokeWidth={1.75} className="size-4" />}
      {children}
    </Button>
  );
}
