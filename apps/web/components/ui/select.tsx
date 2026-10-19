import { cva } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import type { ControlSize } from './input';

/**
 * Native `<select>` styled per v2 (DS "Select"): the Field frame with `appearance-none` and a
 * ChevronDown on the right that ignores the pointer. Native on purpose: it is robust on phones
 * (the OS picker), keyboard accessible and needs no JS.
 */
const selectVariants = cva(
  [
    'peer w-full min-w-0 appearance-none truncate rounded-md border border-concrete-400 bg-surface text-ink',
    'aria-invalid:border-danger',
    'disabled:cursor-not-allowed disabled:border-concrete-200 disabled:bg-concrete-50 disabled:text-cement',
  ],
  {
    variants: {
      size: {
        lg: 'h-12 pr-11 pl-3.5 text-base',
        md: 'h-10 pr-9 pl-2.5 text-sm font-medium',
        sm: 'h-9 pr-8 pl-2 text-sm font-medium',
        xs: 'h-8 pr-7 pl-2 text-sm',
      },
    },
    defaultVariants: { size: 'lg' },
  },
);

const chevronVariants = cva(
  'pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-700 peer-disabled:text-concrete-400',
  {
    variants: {
      size: {
        lg: 'right-3 size-6',
        md: 'right-2.5 size-5',
        sm: 'right-2 size-4',
        xs: 'right-2 size-4',
      },
    },
    defaultVariants: { size: 'lg' },
  },
);

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectProps = Omit<ComponentProps<'select'>, 'size'> & {
  size?: ControlSize;
  /** Rendered as `<option>`s after the placeholder; you can pass `<option>` children instead. */
  options?: readonly SelectOption[];
  /**
   * First option with an empty value, e.g. "Any payment status" in a filter bar or
   * "Choose a category" in a form. It stays selectable so a filter can be cleared.
   */
  placeholder?: string;
  /** Class for the positioning wrapper (width, grid placement). `className` styles the select. */
  wrapperClassName?: string;
};

export function Select({
  className,
  wrapperClassName,
  size,
  options,
  placeholder,
  children,
  ...props
}: SelectProps) {
  return (
    <div data-slot="select" className={cn('relative', wrapperClassName)}>
      <select className={cn(selectVariants({ size }), className)} {...props}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown aria-hidden strokeWidth={1.75} className={chevronVariants({ size })} />
    </div>
  );
}
