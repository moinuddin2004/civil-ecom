'use client';

import { cva } from 'class-variance-authority';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/**
 * shadcn/ui Sheet (Radix Dialog) as a right-hand drawer: full height, sticky header and footer,
 * its body scrolls on its own. `size` is the desktop width; below `md` it is the full screen.
 *
 * Compose it as `<Sheet><SheetContent><SheetHeader/><SheetBody/><SheetFooter/></SheetContent></Sheet>`.
 * A title is required; pass `aria-describedby={undefined}` when there is no description.
 * Put `<SheetFooter>` inside the form when the form owns the submit button — it sticks to the
 * bottom of the scrolling body.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const contentVariants = cva(
  [
    'fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col border-l border-concrete-150 bg-surface text-ink shadow-lifted outline-none',
    'duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
    'motion-reduce:animate-none',
  ],
  {
    variants: {
      size: {
        /** 420: rider, stock adjust, short forms. */
        sm: 'sm:max-w-105',
        /** 520: brand, staff. */
        md: 'sm:max-w-130',
        /** 680: category, longer forms. */
        lg: 'sm:max-w-170',
        /** 880. */
        xl: 'sm:max-w-220',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export type SheetContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  overlayClassName?: string;
};

export function SheetContent({ className, overlayClassName, size, children, ...props }: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-ink/50 duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          overlayClassName,
        )}
      />
      <DialogPrimitive.Content data-slot="sheet-content" className={cn(contentVariants({ size }), className)} {...props}>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Sticky title row at the top of the drawer. */
export function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex shrink-0 items-start justify-between gap-3 border-b border-concrete-150 px-5 py-4', className)}
      {...props}
    />
  );
}

/** The scrolling part of the drawer. */
export function SheetBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5', className)} {...props} />;
}

/** Action row. Inside the form it sticks to the bottom of `SheetBody`. */
export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-5 -mb-5 mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-concrete-150 bg-surface px-5 py-4',
        className,
      )}
      {...props}
    />
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('type-h3 text-ink', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm/[22px] text-ink-700', className)} {...props} />;
}

/** X button for the drawer header. */
export function SheetCloseButton({
  label = 'Close',
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'children'> & { label?: string }) {
  return (
    <DialogPrimitive.Close asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        className={cn('shrink-0 text-ink', className)}
        {...props}
      >
        <X aria-hidden strokeWidth={1.75} className="size-5" />
      </Button>
    </DialogPrimitive.Close>
  );
}
