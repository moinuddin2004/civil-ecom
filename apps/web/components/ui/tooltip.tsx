'use client';

import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  /** What the tooltip says; a string, or a few lines of JSX. */
  content: ReactNode;
  /** The element to hover or focus. Wrap a disabled button in a `span` so it still gets hover events. */
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/**
 * Small tooltip (Radix): shows on hover and keyboard focus, closes on Esc. Each one brings its own
 * provider, so it can be dropped in anywhere, for example next to every icon button of a table row.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className={cn('z-50 max-w-64 rounded-md bg-ink px-3 py-2 text-sm text-white shadow-float', className)}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-ink" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
