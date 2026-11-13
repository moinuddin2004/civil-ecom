'use client';

import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { iconProps } from './styles';

export interface FilterDropdownProps {
  label: string;
  /** How many values of this filter are on; shown as "Brand (2)" and darkens the border. */
  activeCount?: number;
  children: ReactNode;
}

/**
 * One filter of the listing's top bar (HomeRun-style "Brand ▾"). The panel holds server-rendered
 * facet links or the price form, so this is the only client code in the bar.
 */
export function FilterDropdown({ label, activeCount = 0, children }: FilterDropdownProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group flex h-10 items-center gap-1.5 rounded-md border bg-surface px-3 text-sm font-medium whitespace-nowrap',
            activeCount > 0 ? 'border-ink text-ink' : 'border-concrete-200 text-ink-700 hover:border-concrete-400 hover:text-ink',
          )}
        >
          {activeCount > 0 ? `${label} (${activeCount})` : label}
          <ChevronDown {...iconProps} className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent>{children}</PopoverContent>
    </Popover>
  );
}
