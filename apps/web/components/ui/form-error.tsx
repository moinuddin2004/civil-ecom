import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A form-level error (wrong password, account locked, network trouble) shown above the submit
 * button. Announced to screen readers when it appears.
 */
export function FormError({ message, className }: { message: string | null | undefined; className?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn('flex items-start gap-2 rounded-lg bg-danger-50 px-3 py-2.5 text-sm text-danger', className)}>
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
