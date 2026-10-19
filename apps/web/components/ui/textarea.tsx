import { cva } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * v2 textarea: same frame as `Input`, vertical resize only.
 * `lg` storefront (min 88, 16/24), `sm` admin (min 96, 14/20; use `min-h-30` for descriptions).
 */
export const textareaVariants = cva(
  [
    'block w-full min-w-0 resize-y rounded-md border border-concrete-400 bg-surface text-ink',
    'placeholder:text-cement',
    'aria-invalid:border-danger',
    'disabled:cursor-not-allowed disabled:border-concrete-200 disabled:bg-concrete-50 disabled:text-cement',
  ],
  {
    variants: {
      size: {
        lg: 'min-h-22 px-3.5 py-3 text-base',
        sm: 'min-h-24 px-3 py-2.5 text-sm',
      },
    },
    defaultVariants: { size: 'lg' },
  },
);

export type TextareaProps = ComponentProps<'textarea'> & {
  size?: 'lg' | 'sm';
};

export function Textarea({ className, size, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ size }), className)}
      {...props}
    />
  );
}
