import { karachiDateKey } from '@aricon/shared';

/** Date-range presets for the Reports page (SPEC §10.11): all computed in Karachi calendar days. */
export const REPORT_RANGE_PRESETS = ['today', '7d', '30d', 'month', 'custom'] as const;
export type ReportRangePreset = (typeof REPORT_RANGE_PRESETS)[number];

export const REPORT_RANGE_LABELS: Record<ReportRangePreset, string> = {
  today: 'Today',
  '7d': '7 days',
  '30d': '30 days',
  month: 'This month',
  custom: 'Custom',
};

function keyDaysAgo(days: number, now: Date): string {
  return karachiDateKey(new Date(now.getTime() - days * 86_400_000));
}

function firstOfMonthKey(now: Date): string {
  const todayKey = karachiDateKey(now);
  return `${todayKey.slice(0, 7)}-01`;
}

/** `{ from, to }` (inclusive, `YYYY-MM-DD`) for a preset, relative to `now`. */
export function presetRange(preset: ReportRangePreset, now: Date = new Date()): { from: string; to: string } {
  const to = karachiDateKey(now);
  switch (preset) {
    case 'today':
      return { from: to, to };
    case '7d':
      return { from: keyDaysAgo(6, now), to };
    case '30d':
      return { from: keyDaysAgo(29, now), to };
    case 'month':
      return { from: firstOfMonthKey(now), to };
    case 'custom':
      return { from: to, to };
  }
}
