'use client';

import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui Dropdown Menu (Radix), themed with the v2 tokens: arrow-key navigation, Esc and outside
 * click close it, focus returns to the trigger. Used by the admin top bar's user menu.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({ className, sideOffset = 8, align = 'end', ...props }: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn('z-50 min-w-60 overflow-hidden rounded-xl border border-concrete-150 bg-surface p-1.5 shadow-float outline-none', className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return <DropdownMenuPrimitive.Label className={cn('px-2.5 py-2', className)} {...props} />;
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex min-h-10 cursor-default items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-ink outline-none select-none',
        'data-[highlighted]:bg-concrete-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        '[&_svg]:size-4.5 [&_svg]:shrink-0 [&_svg]:text-cement',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn('-mx-1.5 my-1.5 h-px bg-concrete-150', className)} {...props} />;
}
