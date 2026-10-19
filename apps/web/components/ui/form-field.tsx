import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  /** Shown below the control in danger with an icon; takes priority over `hint`. */
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Label + control + helper/error text (DESIGN.md §6 "Text input"): the label is always visible,
 * helper text below, error text in danger with an icon. Used by every form across the storefront,
 * account and admin.
 */
export function FormField({ label, htmlFor, error, hint, required, disabled, children, className }: FormFieldProps) {
  const messageId = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} disabled={disabled}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={messageId} className="flex items-start gap-1 text-sm text-danger">
          <AlertCircle aria-hidden strokeWidth={1.75} className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-sm text-cement">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
