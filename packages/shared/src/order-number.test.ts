import { describe, expect, it } from 'vitest';
import { ORDER_NUMBER_PATTERN, formatOrderNumber, orderCounterId, orderNumberContext } from './order-number.js';

describe('formatOrderNumber (SPEC §6.9)', () => {
  it('pads the sequence to 6 digits', () => {
    expect(formatOrderNumber(2026, 123)).toBe('ARC-2026-000123');
    expect(formatOrderNumber(2026, 1)).toBe('ARC-2026-000001');
    expect(formatOrderNumber(2027, 999_999)).toBe('ARC-2027-999999');
  });

  it('keeps counting past 999,999 instead of truncating', () => {
    expect(formatOrderNumber(2026, 1_000_000)).toBe('ARC-2026-1000000');
  });

  it('produces numbers that match ORDER_NUMBER_PATTERN', () => {
    for (const seq of [1, 123, 999_999, 1_000_000]) {
      expect(formatOrderNumber(2026, seq)).toMatch(ORDER_NUMBER_PATTERN);
    }
  });
});

describe('ORDER_NUMBER_PATTERN', () => {
  it.each(['ARC-2026-00123', 'arc-2026-000123', 'ARC-26-000123', 'ARC-2026-000123x', ' ARC-2026-000123', 'ARC2026000123', ''])(
    'rejects %j',
    (value) => {
      expect(ORDER_NUMBER_PATTERN.test(value)).toBe(false);
    },
  );
});

describe('order counters (SPEC §5.11)', () => {
  it('names the counter after the year', () => {
    expect(orderCounterId(2026)).toBe('order-2026');
  });

  it('uses the Karachi year, so the counter resets at Karachi midnight on 31 Dec UTC', () => {
    expect(orderNumberContext(new Date('2026-12-31T18:59:59Z'))).toEqual({ year: 2026, counterId: 'order-2026' });
    expect(orderNumberContext(new Date('2026-12-31T19:30:00Z'))).toEqual({ year: 2027, counterId: 'order-2027' });
  });

  it('defaults to now', () => {
    const { year, counterId } = orderNumberContext();
    expect(year).toBeGreaterThanOrEqual(2026);
    expect(counterId).toBe(`order-${year}`);
  });
});
