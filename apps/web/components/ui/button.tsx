import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Buttons from the v2 design system. Primary (amber) is reserved for the main action on a screen
 * ("Add to cart", "Place order"); its text is always ink.
 * Heights: lg 48 (storefront main actions, mobile and desktop), md 40 (small storefront controls),
 * sm 36 (admin; icons shrink to 16 px with a 6 px gap). Icon-only: icon-lg 48, icon 44, icon-sm 36.
 */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap',
    'transition-colors duration-150 ease-out select-none',
    'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-primary text-primary-foreground shadow-button',
          'hover:bg-amber-600 active:bg-amber-700',
          'disabled:bg-concrete disabled:text-concrete-400 disabled:shadow-none',
        ],
        secondary: [
          'border border-ink bg-surface text-ink',
          'hover:bg-concrete-50 active:bg-concrete',
          'disabled:border-concrete-200 disabled:bg-surface disabled:text-concrete-400',
        ],
        tertiary: [
          'text-blueprint underline-offset-2',
          'hover:text-blueprint-700 hover:underline active:bg-blueprint-50',
          'disabled:text-concrete-400 disabled:no-underline',
        ],
        destructive: [
          'bg-danger text-white',
          'hover:bg-danger-800 active:bg-danger-900',
          'disabled:bg-concrete disabled:text-concrete-400',
        ],
        /** Admin order header "Cancel order" / "Mark returned", customer "Block" (admin v2 §6). */
        'destructive-outline': [
          'border border-danger bg-surface text-danger',
          'hover:bg-danger-50 active:bg-danger-50',
          'disabled:border-concrete-200 disabled:bg-surface disabled:text-concrete-400',
        ],
        /** Danger text button: storefront "Cancel order", admin "Remove" (no border, no fill). */
        'destructive-ghost': [
          'text-danger hover:bg-danger-50 active:bg-danger-50',
          'disabled:bg-transparent disabled:text-concrete-400',
        ],
        ghost: ['text-ink hover:bg-concrete-50 active:bg-concrete', 'disabled:text-concrete-400'],
        /** Outline for dark (ink) surfaces such as the home hero. */
        inverse: [
          'border border-white bg-transparent text-white',
          'hover:bg-ink-700 active:bg-ink-700',
          'disabled:border-ink-700 disabled:text-concrete-400',
        ],
      },
      size: {
        sm: "h-9 gap-1.5 px-3.5 text-sm has-[>svg]:px-3 [&_svg:not([class*='size-'])]:size-4",
        md: 'h-10 px-5 text-base',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11',
        'icon-sm': 'size-9',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a Next.js `<Link>`) with button styles. */
    asChild?: boolean;
    /** Shows a spinner, disables the button and announces the busy state. */
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      className={classes}
      disabled={Boolean(disabled) || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden strokeWidth={1.75} className="animate-spinner" /> : null}
      {children}
    </button>
  );
}

export { Button, buttonVariants, type ButtonProps };
