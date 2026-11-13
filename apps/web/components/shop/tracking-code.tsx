import { cn } from '@/lib/utils';
import { CopyButton } from './copy-button';

export interface TrackingCodeProps {
  /** The order's 6-digit code; nothing is shown when the order has none (orders from before codes existed). */
  code: string | null;
  /** `card` is the big one for the order pages; `inline` is the small line for lists. */
  variant?: 'card' | 'inline';
  className?: string;
}

/**
 * The 6-digit tracking code of an order with a copy button (SPEC §6.6b). Customers share or type
 * this code on `/track-order` to see where the order is, without signing in.
 */
export function TrackingCode({ code, variant = 'card', className }: TrackingCodeProps) {
  if (!code) return null;

  if (variant === 'inline') {
    return (
      <span className={cn('flex items-center gap-1 text-sm text-cement', className)}>
        Tracking code
        <span className="font-semibold tracking-widest text-ink tabular-nums">{code}</span>
        <CopyButton value={code} label={`Copy tracking code ${code}`} className="relative z-10 -my-1.5" />
      </span>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blueprint-50 px-4 py-3', className)}>
      <div className="flex flex-col">
        <span className="text-sm text-ink-700">Tracking code</span>
        <span className="font-display text-3xl font-bold tracking-[0.25em] text-ink tabular-nums">{code}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="max-w-48 text-xs text-ink-700">Use this code on the Track order page to see where your order is.</span>
        <CopyButton value={code} label="Copy tracking code" className="bg-surface" />
      </div>
    </div>
  );
}
