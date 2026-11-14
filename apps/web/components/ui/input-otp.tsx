import * as React from 'react';
import { Minus } from 'lucide-react';
import { OTPInput, OTPInputContext, type OTPInputProps, REGEXP_ONLY_DIGITS } from 'input-otp';

import { cn } from '@/lib/utils';

export type { OTPInputProps };

export function InputOTP({ className, containerClassName, ...props }: OTPInputProps & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn('flex items-center gap-2 has-[:disabled]:opacity-50', containerClassName)}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  );
}

export function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="input-otp-group" className={cn('flex items-center', className)} {...props} />;
}

export function InputOTPSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="input-otp-separator" className={cn('flex items-center', className)} {...props}>
      <Minus className="size-4 text-cement" />
    </div>
  );
}

export function InputOTPSlot({ index, className, ...props }: React.ComponentProps<'div'> & { index: number }) {
  const context = React.useContext(OTPInputContext);
  const slot = context.slots[index];

  if (!slot) {
    return null;
  }

  return (
    <div
      data-slot="input-otp-slot"
      className={cn(
        'relative flex h-12 w-12 items-center justify-center rounded-md border border-concrete-400 bg-surface text-lg font-semibold text-ink shadow-sm transition-all',
        'first:rounded-l-md last:rounded-r-md',
        slot.isActive && 'z-10 border-primary ring-2 ring-primary/20',
        className,
      )}
      {...props}
    >
      {slot.char !== null ? slot.char : slot.hasFakeCaret ? <div className="pointer-events-none h-5 w-px animate-caret-blink bg-ink" /> : null}
      {slot.placeholderChar !== null && slot.char === null ? (
        <span className="text-cement">{slot.placeholderChar}</span>
      ) : null}
    </div>
  );
}

export { REGEXP_ONLY_DIGITS };
