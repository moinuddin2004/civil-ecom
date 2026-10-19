import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  booleanQuery,
  clearableText,
  csvQuery,
  emailSchema,
  idParams,
  moneySchema,
  objectIdSchema,
  optionalText,
  pageQuery,
  pkPhoneSchema,
  qtySchema,
  requiredText,
  slugSchema,
  sortQuery,
} from './common.js';

const ok = (schema: z.ZodType, input: unknown) => schema.safeParse(input).success;

describe('moneySchema (integer PKR ≥ 0)', () => {
  it('accepts whole rupees from 0', () => {
    for (const value of [0, 1, 425, 125_000, 1_000_000_000]) expect(ok(moneySchema, value)).toBe(true);
  });

  it.each([-1, 0.5, 425.25, Number.NaN, Number.POSITIVE_INFINITY, 1_000_000_001, '425', null])('rejects %j', (value) => {
    expect(ok(moneySchema, value)).toBe(false);
  });
});

describe('qtySchema (SPEC §6.2: integer 1–9,999)', () => {
  it('accepts the boundaries', () => {
    expect(ok(qtySchema, 1)).toBe(true);
    expect(ok(qtySchema, 9999)).toBe(true);
  });

  it.each([0, -1, 10_000, 1.5, '2'])('rejects %j', (value) => {
    expect(ok(qtySchema, value)).toBe(false);
  });

  it('says what the maximum is', () => {
    const result = qtySchema.safeParse(10_000);
    expect(result.success ? '' : result.error.issues[0]?.message).toBe('Quantity can be at most 9,999.');
  });
});

describe('objectIdSchema', () => {
  it('accepts 24 hex characters in either case', () => {
    expect(ok(objectIdSchema, '64b7f0c2e4b0a1a2b3c4d5e6')).toBe(true);
    expect(ok(objectIdSchema, '64B7F0C2E4B0A1A2B3C4D5E6')).toBe(true);
  });

  it.each(['64b7f0c2e4b0a1a2b3c4d5e', '64b7f0c2e4b0a1a2b3c4d5e6a', 'zzb7f0c2e4b0a1a2b3c4d5e6', '', { $gt: '' }, 42])(
    'rejects %j',
    (value) => {
      expect(ok(objectIdSchema, value)).toBe(false);
    },
  );

  it('rejects unknown params keys', () => {
    expect(ok(idParams, { id: '64b7f0c2e4b0a1a2b3c4d5e6', extra: '1' })).toBe(false);
  });
});

describe('emailSchema and pkPhoneSchema', () => {
  it('trims and lower-cases emails', () => {
    expect(emailSchema.parse('  Ali@Example.COM ')).toBe('ali@example.com');
  });

  it.each(['ali', 'ali@', '@example.com', 'ali@example', 'ali example@x.com', `${'a'.repeat(250)}@x.com`])(
    'rejects the email %j',
    (value) => {
      expect(ok(emailSchema, value)).toBe(false);
    },
  );

  it('normalises phones to +923XXXXXXXXX', () => {
    expect(pkPhoneSchema.parse(' 0300-1234567 ')).toBe('+923001234567');
    expect(ok(pkPhoneSchema, '0213456789')).toBe(false);
    expect(ok(pkPhoneSchema, 3001234567)).toBe(false);
  });
});

describe('slugSchema', () => {
  it('lower-cases and accepts single-dash slugs', () => {
    expect(slugSchema.parse(' Cement-Bags ')).toBe('cement-bags');
  });

  it.each(['cement bags', 'cement--bags', '-cement', 'cement_', 'a'.repeat(121)])('rejects %j', (value) => {
    expect(ok(slugSchema, value)).toBe(false);
  });
});

describe('text helpers', () => {
  it('optionalText trims and turns an empty string into undefined', () => {
    const schema = z.object({ note: optionalText(5) });
    expect(schema.parse({ note: '  hi  ' })).toEqual({ note: 'hi' });
    expect(schema.parse({ note: '   ' }).note).toBeUndefined();
    expect(schema.parse({}).note).toBeUndefined();
    expect(ok(schema, { note: '123456' })).toBe(false);
  });

  it('clearableText turns null or an empty string into null', () => {
    const schema = clearableText(5);
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse('  ')).toBeNull();
    expect(schema.parse(' ab ')).toBe('ab');
    expect(ok(schema, undefined)).toBe(false);
  });

  it('requiredText counts characters after trimming', () => {
    const schema = requiredText(3, 5, 'Reason');
    expect(ok(schema, '  ab  ')).toBe(false);
    expect(schema.parse('  abc  ')).toBe('abc');
    const one = requiredText(1, 5, 'Label').safeParse('   ');
    expect(one.success ? '' : one.error.issues[0]?.message).toBe('Label is required.');
  });
});

describe('query helpers', () => {
  const query = z.strictObject({ ...pageQuery });

  it('defaults and coerces paging, capping the page size at 100', () => {
    expect(query.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(query.parse({ page: '3', pageSize: '100' })).toEqual({ page: 3, pageSize: 100 });
    for (const bad of [{ pageSize: '101' }, { pageSize: '0' }, { page: '0' }, { page: '1.5' }, { page: 'abc' }]) {
      expect(ok(query, bad)).toBe(false);
    }
  });

  it('csvQuery splits, trims, drops empty parts and limits the count', () => {
    expect(csvQuery().parse(' a, b ,,c ')).toEqual(['a', 'b', 'c']);
    expect(csvQuery().parse('')).toEqual([]);
    expect(ok(csvQuery(2), 'a,b,c')).toBe(false);
  });

  it('booleanQuery accepts true/false/1/0 only', () => {
    expect(booleanQuery.parse('true')).toBe(true);
    expect(booleanQuery.parse('1')).toBe(true);
    expect(booleanQuery.parse('false')).toBe(false);
    expect(booleanQuery.parse('0')).toBe(false);
    expect(ok(booleanQuery, 'yes')).toBe(false);
    expect(ok(booleanQuery, 'TRUE')).toBe(false);
  });

  it('sortQuery accepts whitelisted fields with an optional direction', () => {
    const sort = sortQuery(['createdAt', 'total']);
    expect(sort.parse('total:desc')).toEqual({ field: 'total', direction: 'desc' });
    expect(sort.parse('createdAt')).toEqual({ field: 'createdAt', direction: 'asc' });
    for (const bad of ['name:asc', 'total:DESC', 'total:', '', '__proto__:asc']) expect(ok(sort, bad)).toBe(false);
  });
});
