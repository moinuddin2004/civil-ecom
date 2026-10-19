'use client';

import { cva } from 'class-variance-authority';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/**
 * Modal dialog (Radix): focus trap, Esc and outside click close, focus returns to the trigger.
 * v2 admin §15: ink/50 overlay, white panel, radius 16, shadow-float, padding 24.
 * `mobile="sheet"` turns it into a bottom sheet below 1024 px (storefront §1.7 and §11: area
 * picker, address form, cancel order), centred from `lg`.
 *
 * Every dialog needs a `DialogTitle`. Add a `DialogDescription`, or pass
 * `aria-describedby={undefined}` to `DialogContent` when there is none.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

const overlayVariants = cva(
  [
    'fixed inset-0 z-50 flex overflow-y-auto bg-ink/50',
    'duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0',
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
  ],
  {
    variants: {
      mobile: {
        center: 'items-center justify-center p-4 sm:p-8',
        sheet: 'items-end justify-center lg:items-center lg:p-8',
      },
    },
    defaultVariants: { mobile: 'center' },
  },
);

const contentVariants = cva(
  [
    'relative flex w-full flex-col gap-4 bg-surface p-6 text-ink shadow-float outline-none',
    'duration-150 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0',
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
  ],
  {
    variants: {
      mobile: {
        center: 'rounded-xl data-[state=open]:zoom-in-95',
        sheet: [
          'max-h-[88dvh] overflow-hidden rounded-t-xl pb-[calc(1.5rem_+_env(safe-area-inset-bottom))]',
          'data-[state=open]:slide-in-from-bottom-4',
          'lg:max-h-[calc(100dvh_-_4rem)] lg:rounded-xl lg:pb-6',
        ],
      },
      size: {
        /** 440: confirm dialogs, stock adjust, cancel order. */
        sm: '',
        /** 460: temporary password. */
        md: '',
        /** 560. */
        lg: '',
        /** 720: receipt preview. */
        xl: '',
      },
    },
    compoundVariants: [
      { mobile: 'center', size: 'sm', className: 'max-w-110' },
      { mobile: 'center', size: 'md', className: 'max-w-115' },
      { mobile: 'center', size: 'lg', className: 'max-w-140' },
      { mobile: 'center', size: 'xl', className: 'max-w-180' },
      { mobile: 'sheet', size: 'sm', className: 'lg:max-w-110' },
      { mobile: 'sheet', size: 'md', className: 'lg:max-w-115' },
      { mobile: 'sheet', size: 'lg', className: 'lg:max-w-140' },
      { mobile: 'sheet', size: 'xl', className: 'lg:max-w-180' },
    ],
    defaultVariants: { mobile: 'center', size: 'sm' },
  },
);

export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** `center` everywhere (default) or a bottom sheet below `lg`. */
  mobile?: 'center' | 'sheet';
  overlayClassName?: string;
};

export function DialogContent({
  className,
  overlayClassName,
  size,
  mobile,
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      {/* The overlay is also the positioning and scroll container (Radix "scrollable overlay"). */}
      <DialogPrimitive.Overlay className={cn(overlayVariants({ mobile }), overlayClassName)}>
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(contentVariants({ mobile, size }), className)}
          {...props}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  );
}

/** Title row: put a `DialogTitle` and, if wanted, a `DialogCloseButton` inside. */
export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-start justify-between gap-3', className)} {...props} />;
}

/** Scrolls on its own when the dialog is taller than the screen (bottom sheet). */
export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto', className)} {...props} />
  );
}

/** Right-aligned actions: secondary first, then the primary or destructive action. */
export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mt-1.5 flex flex-wrap items-center justify-end gap-2', className)}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('type-h3 text-ink', className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm/[22px] text-ink-700', className)}
      {...props}
    />
  );
}

export type DialogCloseButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  /** `md` 44 px (storefront, default) or `sm` 36 px (admin sheet header). */
  size?: 'sm' | 'md';
  label?: string;
};

/** X button that closes the surrounding dialog or sheet. */
export function DialogCloseButton({
  size = 'md',
  label = 'Close',
  className,
  ...props
}: DialogCloseButtonProps) {
  return (
    <DialogPrimitive.Close asChild>
      <Button
        type="button"
        variant="ghost"
        size={size === 'sm' ? 'icon-sm' : 'icon'}
        aria-label={label}
        className={cn('shrink-0 text-ink', className)}
        {...props}
      >
        <X aria-hidden strokeWidth={1.75} className="size-5" />
      </Button>
    </DialogPrimitive.Close>
  );
}
