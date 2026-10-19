import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  adminOrderListQuery,
  adminOrderStatusSchema,
  cancelOrderSchema,
  codCollectedSchema,
  idempotencyKeySchema,
  internalNoteSchema,
  orderNumberParams,
  placeOrderSchema,
  rejectReceiptSchema,
} from './order.js';

function issues(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map(({ path, message, code }) => ({ path, message, code }));
}

const ADDRESS = '64b7f0c2e4b0a1a2b3c4d5e6';

describe('idempotencyKeySchema (SPEC §6.6: UUID v4)', () => {
  it.each(['3b241101-e2bb-4255-8caf-4136c566a962', '3B241101-E2BB-4255-BCAF-4136C566A962', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'])(
    'accepts the v4 UUID %s',
    (key) => {
      expect(idempotencyKeySchema.safeParse(key).success).toBe(true);
    },
  );

  it.each([
    ['v1', 'c232ab00-9414-11ec-b3c8-9f6bdeced846'],
    ['v7', '01890a5d-ac96-774b-bcce-b302099a8057'],
    ['v4 with a bad variant', '3b241101-e2bb-4255-0caf-4136c566a962'],
    ['the nil UUID', '00000000-0000-0000-0000-000000000000'],
    ['no dashes', '3b241101e2bb42558caf4136c566a962'],
    ['braces', '{3b241101-e2bb-4255-8caf-4136c566a962}'],
    ['free text', 'checkout-1'],
    ['empty', ''],
  ])('rejects %s', (_label, key) => {
    expect(issues(idempotencyKeySchema, key)).toEqual([
      expect.objectContaining({ message: 'Idempotency-Key must be a UUID v4.' }),
    ]);
  });
});

describe('placeOrderSchema (SPEC §7.2)', () => {
  const body = { addressId: ADDRESS, paymentMethod: 'COD', expectedTotal: 12_800 };

  it('accepts address, payment method, note and expected total', () => {
    expect(placeOrderSchema.parse({ ...body, customerNote: '  Call before coming  ' })).toEqual({
      ...body,
      customerNote: 'Call before coming',
    });
    expect(placeOrderSchema.parse({ ...body, paymentMethod: 'BANK_TRANSFER' }).paymentMethod).toBe('BANK_TRANSFER');
  });

  it('treats an empty note as no note', () => {
    expect(placeOrderSchema.parse({ ...body, customerNote: '   ' }).customerNote).toBeUndefined();
  });

  it('limits the note to 500 characters', () => {
    expect(issues(placeOrderSchema, { ...body, customerNote: 'x'.repeat(500) })).toEqual([]);
    expect(issues(placeOrderSchema, { ...body, customerNote: 'x'.repeat(501) }).map((i) => i.path)).toEqual([
      ['customerNote'],
    ]);
  });

  it.each(['CARD', 'cod', 'Cash', ''])('rejects the payment method %j', (paymentMethod) => {
    expect(issues(placeOrderSchema, { ...body, paymentMethod }).map((i) => i.path)).toEqual([['paymentMethod']]);
  });

  it.each([12_800.5, -1, '12800', null])('rejects the expected total %j (whole rupees only)', (expectedTotal) => {
    expect(issues(placeOrderSchema, { ...body, expectedTotal }).map((i) => i.path)).toEqual([['expectedTotal']]);
  });

  it('accepts an expected total of 0', () => {
    expect(issues(placeOrderSchema, { ...body, expectedTotal: 0 })).toEqual([]);
  });

  it.each(['items', 'total', 'deliveryFee', 'subtotal', 'userId', 'status', 'paymentStatus'])(
    'rejects client-supplied %s (the server computes it)',
    (key) => {
      expect(issues(placeOrderSchema, { ...body, [key]: 1 })[0]?.code).toBe('unrecognized_keys');
    },
  );

  it('requires a valid address id and every required field', () => {
    expect(issues(placeOrderSchema, { ...body, addressId: 'home' }).map((i) => i.path)).toEqual([['addressId']]);
    expect(issues(placeOrderSchema, { ...body, addressId: { $ne: null } }).map((i) => i.path)).toEqual([['addressId']]);
    for (const key of ['addressId', 'paymentMethod', 'expectedTotal'] as const) {
      const input: Record<string, unknown> = { ...body };
      delete input[key];
      expect(issues(placeOrderSchema, input).map((i) => i.path)).toEqual([[key]]);
    }
  });
});

describe('order number params', () => {
  it('accepts ARC-YYYY-NNNNNN only', () => {
    expect(orderNumberParams.parse({ orderNumber: 'ARC-2026-000123' })).toEqual({ orderNumber: 'ARC-2026-000123' });
    expect(issues(orderNumberParams, { orderNumber: 'ARC-2026-123' })).not.toEqual([]);
    expect(issues(orderNumberParams, { orderNumber: 'arc-2026-000123' })).not.toEqual([]);
  });
});

describe('cancel, status, COD and receipt bodies', () => {
  it('needs a cancel reason of at least 3 characters', () => {
    expect(cancelOrderSchema.parse({ reason: '  Ordered twice ' })).toEqual({ reason: 'Ordered twice' });
    expect(issues(cancelOrderSchema, { reason: '   ' }).map((i) => i.path)).toEqual([['reason']]);
    expect(issues(cancelOrderSchema, {}).map((i) => i.path)).toEqual([['reason']]);
    expect(issues(cancelOrderSchema, { reason: 'x'.repeat(501) })).not.toEqual([]);
  });

  it('accepts only known order statuses as a target', () => {
    expect(adminOrderStatusSchema.parse({ to: 'CANCELLED', reason: 'Out of area' })).toEqual({
      to: 'CANCELLED',
      reason: 'Out of area',
    });
    expect(issues(adminOrderStatusSchema, { to: 'SHIPPED' }).map((i) => i.path)).toEqual([['to']]);
    expect(issues(adminOrderStatusSchema, { to: 'new' }).map((i) => i.path)).toEqual([['to']]);
  });

  it('takes the COD amount in whole rupees', () => {
    expect(codCollectedSchema.parse({ amount: 12_800 })).toEqual({ amount: 12_800 });
    expect(issues(codCollectedSchema, { amount: 12_800.5 })).not.toEqual([]);
    expect(issues(codCollectedSchema, { amount: -1 })).not.toEqual([]);
  });

  it('needs a reason to reject a receipt', () => {
    expect(issues(rejectReceiptSchema, { reason: 'Blurry photo' })).toEqual([]);
    expect(issues(rejectReceiptSchema, { reason: '' })).not.toEqual([]);
  });

  it('limits the internal note to 2,000 characters and allows clearing it', () => {
    expect(internalNoteSchema.parse({ internalNote: '' })).toEqual({ internalNote: '' });
    expect(issues(internalNoteSchema, { internalNote: 'x'.repeat(2_000) })).toEqual([]);
    expect(issues(internalNoteSchema, { internalNote: 'x'.repeat(2_001) })).not.toEqual([]);
  });
});

describe('adminOrderListQuery', () => {
  it('splits a status list and parses sort and dates', () => {
    expect(
      adminOrderListQuery.parse({ status: 'NEW,CONFIRMED', sort: 'total:desc', from: '2026-09-01', to: '2026-09-30' }),
    ).toEqual({
      page: 1,
      pageSize: 20,
      status: ['NEW', 'CONFIRMED'],
      sort: { field: 'total', direction: 'desc' },
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(adminOrderListQuery.parse({ sort: 'createdAt' }).sort).toEqual({ field: 'createdAt', direction: 'asc' });
  });

  it('rejects unknown statuses, sort fields, directions and date formats', () => {
    expect(issues(adminOrderListQuery, { status: 'NEW,BOGUS' })).not.toEqual([]);
    expect(issues(adminOrderListQuery, { sort: 'passwordHash:asc' }).map((i) => i.path)).toEqual([['sort']]);
    expect(issues(adminOrderListQuery, { sort: 'total:up' }).map((i) => i.path)).toEqual([['sort']]);
    expect(issues(adminOrderListQuery, { from: '26/09/2026' }).map((i) => i.path)).toEqual([['from']]);
    expect(issues(adminOrderListQuery, { pageSize: '101' }).map((i) => i.path)).toEqual([['pageSize']]);
    expect(issues(adminOrderListQuery, { page: '0' }).map((i) => i.path)).toEqual([['page']]);
  });
});
