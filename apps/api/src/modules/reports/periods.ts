import { karachiDateKey } from '@aricon/shared';

/*
 * Calendar arithmetic on Karachi date keys (`YYYY-MM-DD`). Keys are plain calendar dates, so the
 * maths runs in UTC where there are no time-zone jumps.
 */

const DAY_MS = 86_400_000;

function toUtc(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

export function addDays(key: string, days: number): string {
  return new Date(toUtc(key).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function todayKey(now: Date = new Date()): string {
  return karachiDateKey(now);
}

/** Every day (`YYYY-MM-DD`) or month (`YYYY-MM`) from `fromKey` to `toKey`, both included. */
export function periodKeys(fromKey: string, toKey: string, unit: 'day' | 'month'): string[] {
  const keys: string[] = [];
  if (unit === 'day') {
    for (let key = fromKey; key <= toKey; key = addDays(key, 1)) keys.push(key);
    return keys;
  }
  const end = toKey.slice(0, 7);
  const cursor = toUtc(`${fromKey.slice(0, 7)}-01`);
  for (let key = fromKey.slice(0, 7); key <= end; ) {
    keys.push(key);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    key = cursor.toISOString().slice(0, 7);
  }
  return keys;
}

/** A series with a point for every period, zeros where nothing happened (charts need no gaps). */
export function fillSeries<T extends { period: string }>(keys: readonly string[], points: readonly T[], empty: (period: string) => T): T[] {
  const byPeriod = new Map(points.map((point) => [point.period, point]));
  return keys.map((key) => byPeriod.get(key) ?? empty(key));
}
