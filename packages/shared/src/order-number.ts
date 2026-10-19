import { karachiYear } from './format.js';

/** Order numbers `ARC-{YYYY}-{seq padded to 6}` with a yearly counter (SPEC §6.9, §5.11). */

export const ORDER_NUMBER_PATTERN = /^ARC-\d{4}-\d{6,}$/;

export function orderCounterId(year: number): string {
  return `order-${year}`;
}

export function formatOrderNumber(year: number, seq: number): string {
  return `ARC-${year}-${String(seq).padStart(6, '0')}`;
}

/** Counter id and year for an order placed at `date` (Karachi calendar year). */
export function orderNumberContext(date: Date = new Date()): { year: number; counterId: string } {
  const year = karachiYear(date);
  return { year, counterId: orderCounterId(year) };
}
