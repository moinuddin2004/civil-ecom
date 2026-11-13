'use client';

import { ChevronDown } from 'lucide-react';
import { Accordion as AccordionPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui Accordion (Radix), themed with the v2 tokens. `type="single" collapsible` for one
 * open section, `type="multiple"` when several can stay open.
 */
export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn('border-b border-concrete-200', className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'group flex min-h-9 flex-1 items-center justify-between gap-2 text-left text-sm font-semibold text-ink',
          'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          '[&[data-state=open]>svg]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-ink-700 transition-transform duration-150" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, children, ...props }: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn('pt-1.5', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}
