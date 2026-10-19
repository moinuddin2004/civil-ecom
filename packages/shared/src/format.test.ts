import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatFileSize,
  karachiDateTimeKey,
  formatNumber,
  formatPKR,
  formatQty,
  formatShortDateTime,
  formatUnitPrice,
  karachiDateKey,
  karachiDayEnd,
  karachiDayStart,
  karachiYear,
  unitLabel,
} from './format.js';

describe('formatPKR (SPEC §6.13)', () => {
  it.each([
    [0, 'Rs 0'],
    [1, 'Rs 1'],
    [425, 'Rs 425'],
    [999, 'Rs 999'],
    [1000, 'Rs 1,000'],
    [125_000, 'Rs 125,000'],
    [1_250_000, 'Rs 1,250,000'],
    [200_000, 'Rs 200,000'],
    [1_000_000_000, 'Rs 1,000,000,000'],
  ])('%i → %s (international grouping)', (amount, expected) => {
    expect(formatPKR(amount)).toBe(expected);
  });

  it('puts the minus sign before "Rs" for negative amounts', () => {
    expect(formatPKR(-425)).toBe('-Rs 425');
    expect(formatPKR(-125_000)).toBe('-Rs 125,000');
  });

  it('never shows decimals or a negative zero', () => {
    expect(formatPKR(425.4)).toBe('Rs 425');
    expect(formatPKR(425.6)).toBe('Rs 426');
    expect(formatPKR(-0)).toBe('Rs 0');
    expect(formatPKR(-0.4)).toBe('Rs 0');
  });
});

describe('number, unit and quantity formatting', () => {
  it('formatNumber groups thousands', () => {
    expect(formatNumber(1250)).toBe('1,250');
    expect(formatNumber(0)).toBe('0');
  });

  it('formatUnitPrice → "Rs 425 / bag"', () => {
    expect(formatUnitPrice(425, 'bag')).toBe('Rs 425 / bag');
    expect(formatUnitPrice(1_430, 'sqft')).toBe('Rs 1,430 / sq ft');
  });

  it('unitLabel is singular only for exactly one', () => {
    expect(unitLabel('bag')).toBe('bag');
    expect(unitLabel('bag', 1)).toBe('bag');
    expect(unitLabel('bag', 12)).toBe('bags');
    expect(unitLabel('bag', 0)).toBe('bags');
    expect(unitLabel('box', 2)).toBe('boxes');
    expect(unitLabel('kg', 5)).toBe('kg');
  });

  it('formatQty → "12 bags"', () => {
    expect(formatQty(12, 'bag')).toBe('12 bags');
    expect(formatQty(1, 'bag')).toBe('1 bag');
    expect(formatQty(1500, 'piece')).toBe('1,500 pieces');
  });

  it('karachiDateTimeKey', () => {
    // 19:05 UTC on 30 Sep is 00:05 on 1 Oct in Karachi.
    expect(karachiDateTimeKey('2026-09-30T19:05:00Z')).toBe('2026-10-01 00:05');
    expect(karachiDateTimeKey('2026-09-26T11:05:00Z')).toBe('2026-09-26 16:05');
  });

  it('formatFileSize', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatFileSize(1_258_291)).toBe('1.2 MB');
    expect(formatFileSize(340 * 1024)).toBe('340 KB');
    expect(formatFileSize(10)).toBe('1 KB');
  });
});

describe('dates in Asia/Karachi (SPEC §6.13)', () => {
  it('formats the spec example "26 Sep 2026, 4:05 pm"', () => {
    expect(formatDateTime('2026-09-26T11:05:00Z')).toBe('26 Sep 2026, 4:05 pm');
    expect(formatDateTime(new Date('2026-09-26T11:05:00Z'))).toBe('26 Sep 2026, 4:05 pm');
    expect(formatDateTime(Date.parse('2026-09-26T11:05:00Z'))).toBe('26 Sep 2026, 4:05 pm');
  });

  it('writes September as "Sep", not "Sept"', () => {
    expect(formatDate('2026-09-26T11:05:00Z')).toBe('26 Sep 2026');
  });

  it('uses short English month names for every month', () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      formatDate(`2026-${String(i + 1).padStart(2, '0')}-15T12:00:00Z`).split(' ')[1],
    );
    expect(months).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  });

  it('shows midnight as 12 am and noon as 12 pm', () => {
    expect(formatDateTime('2026-09-26T19:05:00Z')).toBe('27 Sep 2026, 12:05 am');
    expect(formatDateTime('2026-09-26T07:05:00Z')).toBe('26 Sep 2026, 12:05 pm');
    expect(formatDateTime('2026-09-26T18:59:00Z')).toBe('26 Sep 2026, 11:59 pm');
  });

  it('rolls the date over at Karachi midnight (UTC+5), not UTC midnight', () => {
    expect(formatDate('2026-09-26T18:59:59Z')).toBe('26 Sep 2026');
    expect(formatDate('2026-09-26T19:00:00Z')).toBe('27 Sep 2026');
    expect(formatDate('2026-09-26T23:30:00Z')).toBe('27 Sep 2026');
  });

  it('does not pad the day or the hour', () => {
    expect(formatDateTime('2026-10-04T03:30:00Z')).toBe('4 Oct 2026, 8:30 am');
    expect(formatDateTime('2026-09-09T08:45:00Z')).toBe('9 Sep 2026, 1:45 pm');
  });

  it('formatShortDateTime drops the year', () => {
    expect(formatShortDateTime('2026-09-26T11:05:00Z')).toBe('26 Sep, 4:05 pm');
  });

  it('karachiDateKey gives the Karachi calendar date as YYYY-MM-DD', () => {
    expect(karachiDateKey('2026-09-26T11:05:00Z')).toBe('2026-09-26');
    expect(karachiDateKey('2026-01-04T19:00:00Z')).toBe('2026-01-05');
    expect(karachiDateKey('2026-03-08T18:59:59Z')).toBe('2026-03-08');
  });

  it('karachiDayStart/End bound a Karachi calendar day in UTC (end exclusive)', () => {
    expect(karachiDayStart('2026-09-26').toISOString()).toBe('2026-09-25T19:00:00.000Z');
    expect(karachiDayEnd('2026-09-26').toISOString()).toBe('2026-09-26T19:00:00.000Z');
    expect(karachiDateKey(karachiDayStart('2026-09-26'))).toBe('2026-09-26');
    expect(karachiDateKey(new Date(karachiDayEnd('2026-09-26').getTime() - 1))).toBe('2026-09-26');
  });

  it('karachiYear switches at Karachi new year, before UTC does', () => {
    expect(karachiYear('2026-12-31T18:59:59Z')).toBe(2026);
    expect(karachiYear('2026-12-31T19:00:00Z')).toBe(2027);
    expect(karachiYear('2026-12-31T19:30:00Z')).toBe(2027);
    expect(karachiYear(new Date('2027-01-01T00:00:00Z'))).toBe(2027);
  });

  it('throws on an invalid date instead of printing garbage', () => {
    expect(() => formatDateTime('not a date')).toThrow(RangeError);
  });
});
