import { TIMEZONE } from './constants.js';
import { UNIT_LABELS, type Unit } from './enums.js';

/**
 * Display formatting (SPEC §6.13). Money is integer PKR; dates are stored in UTC and shown in
 * Asia/Karachi.
 */

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** `formatPKR(125000)` → `"Rs 125,000"`. */
export function formatPKR(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}Rs ${numberFormat.format(Math.abs(rounded))}`;
}

/** `formatNumber(1250)` → `"1,250"`. */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Unit name for a quantity: `unitLabel('bag', 1)` → "bag", `unitLabel('bag', 12)` → "bags". */
export function unitLabel(unit: Unit, qty = 1): string {
  const labels = UNIT_LABELS[unit];
  return qty === 1 ? labels.one : labels.many;
}

/** `formatUnitPrice(425, 'bag')` → `"Rs 425 / bag"`. */
export function formatUnitPrice(amount: number, unit: Unit): string {
  return `${formatPKR(amount)} / ${unitLabel(unit, 1)}`;
}

/** `formatQty(12, 'bag')` → `"12 bags"`. */
export function formatQty(qty: number, unit: Unit): string {
  return `${formatNumber(qty)} ${unitLabel(unit, qty)}`;
}

/*
 * Dates are split into numeric Karachi-time parts and assembled here, instead of relying on a
 * locale's month names and hour cycle: en-GB abbreviates September as "Sept" in current ICU data
 * and some engines render midnight as "0:05" with `hour12`, while the UI must show "26 Sep 2026,
 * 12:05 am" everywhere (server and browsers alike).
 */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const karachiFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

interface KarachiParts {
  year: number;
  /** 1–12. */
  month: number;
  day: number;
  /** 0–23. */
  hour: number;
  minute: number;
}

/** Calendar and clock parts of `date` in Karachi time. Throws a RangeError for an invalid date. */
function karachiParts(date: Date | string | number): KarachiParts {
  const value = date instanceof Date ? date : new Date(date);
  const map: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of karachiFormat.formatToParts(value)) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    // Some engines print midnight as "24" even with h23.
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function dayMonth(p: KarachiParts): string {
  return `${p.day} ${MONTHS_SHORT[p.month - 1] ?? ''}`;
}

function time(p: KarachiParts): string {
  return `${p.hour % 12 || 12}:${pad2(p.minute)} ${p.hour < 12 ? 'am' : 'pm'}`;
}

/** `"26 Sep 2026"` in Karachi time. */
export function formatDate(date: Date | string | number): string {
  const p = karachiParts(date);
  return `${dayMonth(p)} ${p.year}`;
}

/** `"26 Sep 2026, 4:05 pm"` in Karachi time (SPEC §6.13). */
export function formatDateTime(date: Date | string | number): string {
  const p = karachiParts(date);
  return `${dayMonth(p)} ${p.year}, ${time(p)}`;
}

/** `"26 Sep, 4:05 pm"` for timelines and dense tables. */
export function formatShortDateTime(date: Date | string | number): string {
  const p = karachiParts(date);
  return `${dayMonth(p)}, ${time(p)}`;
}

/** Calendar date `YYYY-MM-DD` in Karachi time (report grouping, date filters). */
export function karachiDateKey(date: Date | string | number): string {
  const p = karachiParts(date);
  return `${String(p.year).padStart(4, '0')}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** `YYYY-MM-DD HH:mm` (24 h) in Karachi time: sorts correctly as text, for spreadsheet exports. */
export function karachiDateTimeKey(date: Date | string | number): string {
  const p = karachiParts(date);
  return `${karachiDateKey(date)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Pakistan keeps UTC+5 all year (no daylight saving). */
const KARACHI_OFFSET = '+05:00';
const DAY_MS = 86_400_000;

/** The UTC instant a Karachi calendar day (`YYYY-MM-DD`) starts — for "from" date filters. */
export function karachiDayStart(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00${KARACHI_OFFSET}`);
}

/** The UTC instant the day after `dateKey` starts (exclusive end) — so "to 2026-09-26" includes that whole day. */
export function karachiDayEnd(dateKey: string): Date {
  return new Date(karachiDayStart(dateKey).getTime() + DAY_MS);
}

/** Year in Karachi time; order numbers and their counters use it (SPEC §6.9). */
export function karachiYear(date: Date | string | number = new Date()): number {
  return karachiParts(date).year;
}

/** Bytes as "1.2 MB" / "340 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
