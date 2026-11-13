'use client';

import { cva } from 'class-variance-authority';
import { Check, ChevronDown } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import { useRef, useState, type ChangeEvent, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import type { ControlSize } from './input';

/**
 * shadcn/ui Select (Radix), themed with the v2 tokens. The small `options` API on top is a
 * convenience for this codebase: it renders the shadcn `SelectItem`s, keeps an uncontrolled
 * `defaultValue`, fires the old native-shaped `onChange` (so plain GET filter forms and existing
 * handlers keep working) and renders a hidden input for `name`.
 *
 * Radix does not allow an empty string as an item value, so the empty choice is a sentinel that
 * maps back to `''` — that keeps "None (top level)" / "Any status" clearable.
 */
const EMPTY_VALUE = '__empty__';

const triggerVariants = cva(
  [
    'peer flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-concrete-400 bg-surface text-left text-ink',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'aria-invalid:border-danger',
    'disabled:cursor-not-allowed disabled:border-concrete-200 disabled:bg-concrete-50 disabled:text-cement',
    'data-[placeholder]:text-cement',
    '[&>span]:min-w-0 [&>span]:truncate',
  ],
  {
    variants: {
      size: {
        lg: 'h-12 px-3.5 text-base',
        md: 'h-10 px-3 text-sm font-medium',
        sm: 'h-9 px-2.5 text-sm font-medium',
        xs: 'h-8 px-2 text-sm',
      },
    },
    defaultVariants: { size: 'lg' },
  },
);

const iconVariants = cva('pointer-events-none shrink-0 text-ink-700', {
  variants: {
    size: { lg: 'size-6', md: 'size-5', sm: 'size-4', xs: 'size-4' },
  },
  defaultVariants: { size: 'lg' },
});

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectProps = {
  id?: string;
  /** Renders a hidden input so a plain `<form method="get">` submits the choice. */
  name?: string;
  size?: ControlSize;
  options?: readonly SelectOption[];
  /** Shown when nothing is selected; also offered as the cleared choice. */
  placeholder?: string;
  className?: string;
  /** Class for the wrapper (width, grid placement). `className` styles the trigger. */
  wrapperClassName?: string;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Native-shaped change event, for `register()`-free call sites and GET filter bars. */
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: () => void;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

function Item({ option }: { option: SelectOption }) {
  return (
    <SelectPrimitive.Item
      value={option.value}
      disabled={option.disabled}
      className={cn(
        'relative flex w-full cursor-default scroll-my-1 items-center rounded-sm py-1.5 pr-8 pl-2 text-sm',
        'outline-none select-none data-[highlighted]:bg-concrete-50 data-[highlighted]:text-ink',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      )}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check aria-hidden strokeWidth={2} className="size-4 text-blueprint" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function Select({
  id,
  name,
  size,
  options,
  placeholder,
  className,
  wrapperClassName,
  disabled,
  value,
  defaultValue,
  onValueChange,
  onChange,
  onBlur,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: SelectProps) {
  const controlled = value !== undefined;
  const hiddenInput = useRef<HTMLInputElement>(null);
  const [internal, setInternal] = useState(() => String(defaultValue ?? ''));
  const current = controlled ? String(value ?? '') : internal;

  function choose(next: string) {
    if (!controlled) setInternal(next);
    const plain = next === EMPTY_VALUE ? '' : next;
    onValueChange?.(plain);
    onChange?.({ target: { name, value: plain } } as unknown as ChangeEvent<HTMLSelectElement>);
    // Forms that watch for changes (the admin list filters) hear about it once the hidden input has the new value.
    if (name) window.setTimeout(() => hiddenInput.current?.dispatchEvent(new Event('change', { bubbles: true })), 0);
  }

  return (
    <div className={cn('relative', wrapperClassName)} data-slot="select">
      {name ? <input ref={hiddenInput} type="hidden" name={name} value={current} readOnly /> : null}
      <SelectPrimitive.Root
        value={current === '' ? EMPTY_VALUE : current}
        onValueChange={choose}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          id={id}
          aria-invalid={ariaInvalid || undefined}
          aria-describedby={ariaDescribedBy}
          onBlur={onBlur}
          className={cn(triggerVariants({ size }), className)}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown aria-hidden strokeWidth={1.75} className={iconVariants({ size })} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className={cn(
              'z-50 max-h-[min(18rem,var(--radix-select-content-available-height))] overflow-hidden rounded-md border border-concrete-150 bg-surface text-ink shadow-lifted',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95',
            )}
          >
            <SelectPrimitive.Viewport className="min-w-[var(--radix-select-trigger-width)] p-1">
              {placeholder !== undefined ? <Item option={{ value: EMPTY_VALUE, label: placeholder }} /> : null}
              {options?.map((option) => <Item key={option.value} option={option} />)}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

/* The raw shadcn parts, for places that need full control (e.g. a searchable list). */
export const SelectRoot = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;
export const SelectTrigger = SelectPrimitive.Trigger;
export const SelectContent = SelectPrimitive.Content;
export const SelectItem = SelectPrimitive.Item;
export const SelectSeparator = SelectPrimitive.Separator;
export type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger>;
