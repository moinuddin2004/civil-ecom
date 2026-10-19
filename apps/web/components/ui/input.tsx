import { cva } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Control heights shared by inputs, selects and the field helpers (v2 references):
 * - `lg` 48: storefront fields at every width (account, checkout, address, auth).
 * - `md` 40: small storefront controls (price range, desktop sort) and the staff login.
 * - `sm` 36: admin forms and filter bars.
 * - `xs` 32: inputs inside admin tables (variants, bulk tiers).
 */
export type ControlSize = 'lg' | 'md' | 'sm' | 'xs';

/**
 * v2 text input: 1 px concrete-400 border, radius 10, white. Focus uses the global 2 px blueprint
 * outline (offset 2). `aria-invalid` turns the border danger; disabled is concrete-50 with cement
 * text. Read-only (locked) styling lives in `LockedField`, not here, because `:read-only` also
 * matches disabled inputs.
 */
export const inputVariants = cva(
  [
    'w-full min-w-0 rounded-md border border-concrete-400 bg-surface text-ink',
    'placeholder:text-cement',
    'aria-invalid:border-danger',
    'disabled:cursor-not-allowed disabled:border-concrete-200 disabled:bg-concrete-50 disabled:text-cement',
  ],
  {
    variants: {
      size: {
        lg: 'h-12 px-3.5 text-base',
        md: 'h-10 px-3 text-[15px]/5',
        sm: 'h-9 px-2.5 text-sm',
        xs: 'h-8 px-2 text-sm tabular-nums',
      },
    },
    defaultVariants: { size: 'lg' },
  },
);

export type InputProps = Omit<ComponentProps<'input'>, 'size'> & {
  /** Control height; see `ControlSize`. Defaults to `lg` (48 px, storefront). */
  size?: ControlSize;
};

export function Input({ className, size, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}
