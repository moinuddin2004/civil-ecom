'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { iconProps } from './styles';

export interface CopyButtonProps {
  /** The text put on the clipboard. */
  value: string;
  /** Read out by screen readers, e.g. "Copy order number". */
  label: string;
  className?: string;
}

/**
 * Icon button that copies `value` to the clipboard and shows a check for a moment. The clipboard
 * API can be missing (insecure context, old browsers); the value is still on screen then, so the
 * button simply does nothing instead of erroring.
 */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // See the component comment.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-md text-cement hover:bg-concrete-50 hover:text-ink',
        copied && 'text-success',
        className,
      )}
    >
      {copied ? <Check {...iconProps} className="size-4" /> : <Copy {...iconProps} className="size-4" />}
      <span aria-live="polite" className="sr-only">
        {copied ? 'Copied' : ''}
      </span>
    </button>
  );
}
