import type { PaymentMethod } from '@aricon/shared';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { CARD_CLASS } from './styles';

export interface PaymentMethodCardProps {
  method: PaymentMethod;
  title: string;
  description: string;
  /** Why an enabled method can't be chosen right now, e.g. the COD order-limit message. */
  reason?: string | null;
  disabled?: boolean;
  selected: boolean;
}

/**
 * Payment method radio card (DESIGN.md §6 "Payment method card"): a 2 px ink border when selected;
 * a disabled method (COD over the order limit) stays visible with its reason instead of vanishing.
 * Render inside a `<RadioGroup>` from `components/ui/radio-group`.
 */
export function PaymentMethodCard({ method, title, description, reason, disabled = false, selected }: PaymentMethodCardProps) {
  const inputId = `payment-method-${method}`;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        CARD_CLASS,
        'flex items-start gap-3 p-4',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        selected && !disabled && 'border-2 border-ink',
      )}
    >
      <RadioGroupItem id={inputId} value={method} size="md" disabled={disabled} className="mt-0.5 shrink-0" />
      <span className="flex flex-col gap-1">
        <span className="font-semibold text-ink">{title}</span>
        <span className="text-sm text-ink-700">{description}</span>
        {reason ? <span className="text-sm text-danger">{reason}</span> : null}
      </span>
    </label>
  );
}
