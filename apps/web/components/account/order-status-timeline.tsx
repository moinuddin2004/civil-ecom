import { formatShortDateTime, type TimelineStep } from '@aricon/shared';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OrderStatusTimelineProps {
  steps: TimelineStep[];
}

const CIRCLE_CLASS: Record<TimelineStep['state'], string> = {
  done: 'border-success bg-success text-white',
  current: 'border-amber bg-amber text-ink',
  upcoming: 'border-concrete-400 bg-surface text-concrete-400',
  failed: 'border-danger bg-danger text-white',
};

const LINE_CLASS: Record<TimelineStep['state'], string> = {
  done: 'bg-success',
  current: 'bg-concrete-200',
  upcoming: 'bg-concrete-200',
  failed: 'bg-danger',
};

/**
 * Order status timeline (DESIGN.md §6 "Order status timeline"): Placed → Confirmed → On the way →
 * Delivered, or the path so far ending in a danger Cancelled/Returned state. Steps come from the
 * shared `orderTimeline()` (packages/shared/src/order-status.ts), so this is pure display.
 * Stacked vertically on mobile, a connected row on desktop.
 */
export function OrderStatusTimeline({ steps }: OrderStatusTimelineProps) {
  return (
    <ol className="flex flex-col sm:flex-row sm:items-start">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.status} className="flex gap-3 sm:flex-1 sm:flex-col sm:gap-2">
            <div className="flex flex-col items-center sm:w-full sm:flex-row">
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-semibold',
                  CIRCLE_CLASS[step.state],
                )}
              >
                {step.state === 'done' ? (
                  <Check strokeWidth={2} className="size-4" />
                ) : step.state === 'failed' ? (
                  <X strokeWidth={2} className="size-4" />
                ) : (
                  <span className="text-sm">{index + 1}</span>
                )}
              </span>
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn('my-1 w-0.5 flex-1 sm:my-0 sm:ml-2 sm:h-0.5 sm:w-full sm:flex-none', LINE_CLASS[step.state])}
                />
              ) : null}
            </div>
            <div className={cn('flex flex-col pb-4 sm:pb-0', isLast && 'pb-0')}>
              <span className={cn('text-sm font-semibold', step.state === 'upcoming' ? 'text-concrete-400' : 'text-ink')}>
                {step.label}
              </span>
              {step.at ? <span className="text-xs text-cement">{formatShortDateTime(step.at)}</span> : null}
              {step.note ? <span className="text-xs text-danger">{step.note}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
