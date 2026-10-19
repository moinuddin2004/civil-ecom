'use client';

import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * v2 switch: track 40×22, success when on and concrete-400 when off; an 18 px white thumb that
 * moves from 2 to 20 px. Track colour and thumb move in 150 ms (only after a click or key press).
 * Renders `role="switch"` with `aria-checked`; label it with `<label htmlFor>` or `aria-label`.
 */
export function Switch({
  className,
  ...props
}: Omit<ComponentProps<typeof SwitchPrimitive.Root>, 'children'>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-[22px] w-10 shrink-0 items-center rounded-full bg-concrete-400',
        'transition-colors duration-150 ease-out data-[state=checked]:bg-success',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-[18px] translate-x-0.5 rounded-full bg-white',
          'transition-transform duration-150 ease-out data-[state=checked]:translate-x-5',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
