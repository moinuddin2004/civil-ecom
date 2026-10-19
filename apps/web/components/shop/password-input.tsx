'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { iconProps } from './styles';

/**
 * A password field with a show/hide toggle, shared by login, signup and reset-password (DESIGN.md
 * §6 "Text input"). The toggle never submits the form and is announced to assistive tech.
 */
export function PasswordInput({ className, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-cement hover:text-ink"
      >
        {visible ? (
          <EyeOff {...iconProps} className="size-5" />
        ) : (
          <Eye {...iconProps} className="size-5" />
        )}
      </button>
    </div>
  );
}
