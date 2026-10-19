'use client';

import { cva } from 'class-variance-authority';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * v2 radio: a circle with a 2 px border. Off: concrete-400. On: ink border with an ink dot.
 * Sizes: `sm` 18 with an 8 px dot (admin), `md` 22 with a 10 px dot (storefront radio cards).
 * Radix gives roving focus and arrow-key selection; pair each item with a `<label htmlFor>`.
 */
export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

const radioVariants = cva(
  [
    'peer inline-grid aspect-square shrink-0 place-items-center rounded-full border-2 border-concrete-400 bg-surface',
    'data-[state=checked]:border-ink',
    'aria-invalid:border-danger',
    'disabled:cursor-not-allowed disabled:border-concrete-200 disabled:bg-concrete-50',
  ],
  {
    variants: {
      size: {
        sm: 'size-[18px]',
        md: 'size-[22px]',
      },
    },
    defaultVariants: { size: 'sm' },
  },
);

export type RadioGroupItemProps = Omit<ComponentProps<typeof RadioGroupPrimitive.Item>, 'children'> & {
  size?: 'sm' | 'md';
};

export function RadioGroupItem({ className, size, ...props }: RadioGroupItemProps) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(radioVariants({ size }), className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        className={cn(
          'block rounded-full bg-ink',
          size === 'md' ? 'size-2.5' : 'size-2',
          props.disabled && 'bg-concrete-400',
        )}
      />
    </RadioGroupPrimitive.Item>
  );
}
