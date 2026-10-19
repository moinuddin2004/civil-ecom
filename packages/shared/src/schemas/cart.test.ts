import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { cartItemSchema, cartQuerySchema, cartQuoteSchema, mergeCartSchema, setCartItemSchema } from './cart.js';

const ok = (schema: z.ZodType, input: unknown) => schema.safeParse(input).success;

const P = '64b7f0c2e4b0a1a2b3c4d5e6';
const V = '64b7f0c2e4b0a1a2b3c4d5e7';
const item = { productId: P, variantId: V, qty: 3 };

describe('cart item (SPEC §6.2: qty is an integer 1–9,999)', () => {
  it('accepts a line', () => {
    expect(cartItemSchema.parse(item)).toEqual(item);
    expect(ok(cartItemSchema, { ...item, qty: 9999 })).toBe(true);
  });

  it.each([0, -1, 10_000, 2.5, '3'])('rejects qty %j', (qty) => {
    expect(ok(cartItemSchema, { ...item, qty })).toBe(false);
  });

  it('never takes a price from the client', () => {
    expect(ok(cartItemSchema, { ...item, price: 1 })).toBe(false);
    expect(ok(cartItemSchema, { ...item, unitPrice: 1 })).toBe(false);
  });
});

describe('quote and merge (SPEC §6.3, §5.7: at most 50 lines)', () => {
  const lines = (n: number) => Array.from({ length: n }, () => item);

  it('accepts up to 50 lines and an optional area', () => {
    expect(ok(cartQuoteSchema, { items: lines(50) })).toBe(true);
    expect(ok(cartQuoteSchema, { items: [], areaId: P })).toBe(true);
    expect(ok(mergeCartSchema, { items: lines(50) })).toBe(true);
  });

  it('rejects more than 50 lines, a bad area id and unknown keys', () => {
    expect(ok(cartQuoteSchema, { items: lines(51) })).toBe(false);
    expect(ok(mergeCartSchema, { items: lines(51) })).toBe(false);
    expect(ok(cartQuoteSchema, { items: [], areaId: 'gulshan' })).toBe(false);
    expect(ok(mergeCartSchema, { items: [], userId: P })).toBe(false);
  });

  it('validates the cart query', () => {
    expect(ok(cartQuerySchema, {})).toBe(true);
    expect(ok(cartQuerySchema, { areaId: P })).toBe(true);
    expect(ok(cartQuerySchema, { areaId: P, debug: '1' })).toBe(false);
  });
});

describe('setCartItemSchema', () => {
  it('uses qty 0 to remove a line and caps at 9,999', () => {
    expect(setCartItemSchema.parse({ variantId: V, qty: 0 })).toEqual({ variantId: V, qty: 0 });
    expect(ok(setCartItemSchema, { variantId: V, qty: 9999 })).toBe(true);
    expect(ok(setCartItemSchema, { variantId: V, qty: 10_000 })).toBe(false);
    expect(ok(setCartItemSchema, { variantId: V, qty: -1 })).toBe(false);
    expect(ok(setCartItemSchema, { variantId: V, qty: 1.5 })).toBe(false);
  });
});
