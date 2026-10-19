import { describe, expect, it } from 'vitest';
import { addDays, fillSeries, periodKeys, todayKey } from './periods.js';

describe('report periods (Karachi calendar)', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it("today is Karachi's date, ahead of UTC late in the evening", () => {
    expect(todayKey(new Date('2026-09-26T19:30:00Z'))).toBe('2026-09-27');
  });

  it('lists days and months, both ends included', () => {
    expect(periodKeys('2026-09-29', '2026-10-02', 'day')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(periodKeys('2026-11-15', '2027-02-01', 'month')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(periodKeys('2026-09-05', '2026-09-05', 'day')).toEqual(['2026-09-05']);
  });

  it('fills the gaps with empty points', () => {
    const series = fillSeries(['2026-09-01', '2026-09-02', '2026-09-03'], [{ period: '2026-09-02', orders: 3 }], (period) => ({
      period,
      orders: 0,
    }));
    expect(series.map((point) => point.orders)).toEqual([0, 3, 0]);
  });
});
