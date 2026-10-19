'use client';

import { QTY_MAX, QTY_MIN } from '@aricon/shared';
import { Minus, Plus } from 'lucide-react';
import { useId, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { iconProps } from './styles';

const MAX_DIGITS = String(QTY_MAX).length;

const SIZES = {
  /** Product page: 48 × 48 buttons, 24 px icons, value 18/24 (v2 §1.14). */
  lg: { button: 'size-12', icon: 'size-6', input: 'w-16 text-lg' },
  /** Cart line: 48 on mobile (CLAUDE.md), 44 × 44 on desktop (v2), 20 px icons, value 16/20. */
  md: { button: 'size-12 lg:size-11', icon: 'size-5', input: 'w-[52px] text-base/5' },
} as const;

/** Whole number in `1…max` (max itself never above 9,999, SPEC §6.2). Anything else becomes 1. */
export function clampQty(qty: number, max: number = QTY_MAX): number {
  const upper = Math.max(QTY_MIN, Math.min(Math.trunc(max), QTY_MAX));
  if (!Number.isFinite(qty)) return QTY_MIN;
  return Math.min(Math.max(Math.trunc(qty), QTY_MIN), upper);
}

export interface QuantityStepperProps {
  value: number;
  onChange: (qty: number) => void;
  /** Upper bound, e.g. the variant's stock. Capped at 9,999. */
  max?: number;
  /**
   * Disable "+" at `max` (product page). The cart passes false: it only caps at 9,999 and the line's
   * stock banner explains the rest (v2 §1.14).
   */
  capAtMax?: boolean;
  size?: keyof typeof SIZES;
  /** Out of stock: the whole stepper at 50% and not editable. */
  disabled?: boolean;
  /** Visible label on the left ("Quantity", 72 px wide). Without it the input is labelled for screen readers. */
  label?: string;
  /** Text after the control, e.g. "bags" (always plural, v2 §1.13 C). */
  unitText?: string;
  /** Shown under the control while the value is at `max`, e.g. "Only 38 in stock". */
  maxHint?: string;
  id?: string;
  className?: string;
}

/**
 * − [qty] + stepper (v2 §1.14, DESIGN.md §6). Typing strips non-digits and clamps to 1…max; an empty
 * or zero value becomes 1 when the field loses focus. Arrow up and down change the value by one.
 */
export function QuantityStepper({
  value,
  onChange,
  max = QTY_MAX,
  capAtMax = true,
  size = 'lg',
  disabled = false,
  label,
  unitText,
  maxHint,
  id,
  className,
}: QuantityStepperProps) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-quantity`;
  const hintId = `${autoId}-hint`;
  // What the person is typing while it isn't a valid quantity yet ("" or "0"); null otherwise.
  const [draft, setDraft] = useState<string | null>(null);

  const upper = capAtMax ? clampQty(max) : QTY_MAX;
  const style = SIZES[size];
  const showHint = Boolean(maxHint) && capAtMax && !disabled && value >= upper;
  const minusDisabled = disabled || value <= QTY_MIN;
  const plusDisabled = disabled || value >= upper;

  function commit(qty: number) {
    const next = clampQty(qty, upper);
    if (next !== value) onChange(next);
  }

  function commitDraft() {
    if (draft === null) return;
    setDraft(null);
    commit(Number(draft) || QTY_MIN);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS);
    if (digits === '' || Number(digits) < QTY_MIN) {
      setDraft(digits);
      return;
    }
    setDraft(null);
    commit(Number(digits));
  }

  /** −1 / +1 from the last valid value; drops an unfinished draft (Safari doesn't blur on click). */
  function step(delta: number) {
    setDraft(null);
    commit(value + delta);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      commitDraft();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      step(-1);
    }
  }

  const buttonClass = cn(
    style.button,
    'flex shrink-0 items-center justify-center bg-surface text-ink',
    'enabled:hover:bg-concrete-50 enabled:active:bg-concrete disabled:text-concrete-400',
    // The frame clips its overflow, so draw the focus ring inside.
    'focus-visible:-outline-offset-2',
  );

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-center gap-3">
        {label ? (
          <label htmlFor={inputId} className="w-[72px] text-sm font-medium">
            {label}
          </label>
        ) : null}
        <div
          className={cn(
            'flex overflow-hidden rounded-md border border-concrete-400 bg-surface',
            disabled && 'opacity-50',
          )}
        >
          <button
            type="button"
            aria-label="Decrease"
            aria-controls={inputId}
            disabled={minusDisabled}
            onClick={() => step(-1)}
            className={buttonClass}
          >
            <Minus {...iconProps} className={style.icon} />
          </button>
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label={label ? undefined : 'Quantity'}
            aria-describedby={showHint ? hintId : undefined}
            disabled={disabled}
            value={draft ?? String(value)}
            onChange={handleChange}
            onBlur={commitDraft}
            onKeyDown={handleKeyDown}
            className={cn(
              style.input,
              'min-w-0 border-x border-concrete-200 bg-surface text-center font-semibold text-ink tabular-nums',
              'focus-visible:-outline-offset-2',
            )}
          />
          <button
            type="button"
            aria-label="Increase"
            aria-controls={inputId}
            disabled={plusDisabled}
            onClick={() => step(1)}
            className={buttonClass}
          >
            <Plus {...iconProps} className={style.icon} />
          </button>
        </div>
        {unitText ? <span className="text-sm text-ink-700">{unitText}</span> : null}
      </div>
      {showHint ? (
        <p id={hintId} className="text-[13px]/[18px] text-ink-700">
          {maxHint}
        </p>
      ) : null}
    </div>
  );
}
