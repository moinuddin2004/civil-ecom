import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { REPORT_RANGE_LABELS, REPORT_RANGE_PRESETS, type ReportRangePreset } from '@/lib/admin/report-dates';
import { cn } from '@/lib/utils';

export interface ReportDateRangeProps {
  preset: ReportRangePreset;
  from: string;
  to: string;
}

/**
 * Date range presets + custom range (SPEC §10.11, DESIGN.md §9.6). Plain `<Link>`s and a
 * `method="get"` form, same zero-JS idiom as the storefront filter panel: the page re-renders
 * server-side with the new `preset`/`from`/`to`, no client fetching needed.
 */
export function ReportDateRange({ preset, from, to }: ReportDateRangeProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap gap-1.5">
        {REPORT_RANGE_PRESETS.filter((p) => p !== 'custom').map((p) => (
          <Link
            key={p}
            href={`/admin/reports?preset=${p}`}
            aria-current={preset === p || undefined}
            className={cn(
              'flex h-9 items-center rounded-full border px-3.5 text-sm font-medium',
              preset === p ? 'border-ink bg-ink text-white' : 'border-concrete-200 bg-surface text-ink-700 hover:border-concrete-400',
            )}
          >
            {REPORT_RANGE_LABELS[p]}
          </Link>
        ))}
      </div>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="preset" value="custom" />
        <div className="flex flex-col gap-1">
          <label htmlFor="report-from" className="text-xs text-cement">
            From
          </label>
          <Input id="report-from" type="date" name="from" size="sm" defaultValue={preset === 'custom' ? from : undefined} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="report-to" className="text-xs text-cement">
            To
          </label>
          <Input id="report-to" type="date" name="to" size="sm" defaultValue={preset === 'custom' ? to : undefined} />
        </div>
        <Button type="submit" size="sm" variant={preset === 'custom' ? 'primary' : 'secondary'}>
          Apply
        </Button>
      </form>
    </div>
  );
}
