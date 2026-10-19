import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type LabelProps = ComponentProps<'label'> & {
  /** Cement text for a disabled control (v2 "Field disabled"). */
  disabled?: boolean;
};

/**
 * Field label: Noto 500 14/20 ink, above the control. A native `<label>` (no JS), so it also works
 * in Server Components; connect it with `htmlFor`.
 */
export function Label({ className, disabled = false, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      data-disabled={disabled || undefined}
      className={cn('text-sm font-medium text-ink', disabled && 'text-cement', className)}
      {...props}
    />
  );
}
