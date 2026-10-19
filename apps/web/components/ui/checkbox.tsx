'use client';

import { cva } from 'class-variance-authority';
import { Check, Minus } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * v2 checkbox: radius 4, 1.5 px border. Off: white with a concrete-400 border. On: ink with a white
 * 14 px check (stroke 2.5). Indeterminate (`checked="indeterminate"`, for a tri-state "Select all"):
 * ink with a minus. Sizes: `sm` 18 (admin), `md` 20 (storefront filters), `lg` 22 (filter sheet).
 * Put the label next to it with `htmlFor`, so the whole row is clickable.
 */
const checkboxVariants = cva(
  [
    'peer inline-grid shrink-0 place-items-center rounded-xs border-[1.5px] border-concrete-400 bg-surface text-white',
    'data-[state=checked]:border-ink data-[state=checked]:bg-ink',
    'data-[state=indeterminate]:border-ink data-[state=indeterminate]:bg-ink',
    'aria-invalid:border-danger',
    'disabled:cursor-not-allowed disabled:border-concrete-200 disabled:bg-concrete-50',
    'disabled:data-[state=checked]:border-concrete-400 disabled:data-[state=checked]:bg-concrete-400',
    'disabled:data-[state=indeterminate]:border-concrete-400 disabled:data-[state=indeterminate]:bg-concrete-400',
  ],
  {
    variants: {
      size: {
        sm: 'size-[18px]',
        md: 'size-5',
        lg: 'size-[22px]',
      },
    },
    defaultVariants: { size: 'sm' },
  },
);

export type CheckboxProps = Omit<ComponentProps<typeof CheckboxPrimitive.Root>, 'children'> & {
  size?: 'sm' | 'md' | 'lg';
};

export function Checkbox({ className, size, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(checkboxVariants({ size }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="group/indicator grid place-items-center">
        <Check
          aria-hidden
          strokeWidth={2.5}
          className="size-3.5 group-data-[state=indeterminate]/indicator:hidden"
        />
        <Minus
          aria-hidden
          strokeWidth={2.5}
          className="hidden size-3.5 group-data-[state=indeterminate]/indicator:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/** `true`, `false` or `'indeterminate'`. */
export type CheckedState = CheckboxPrimitive.CheckedState;
