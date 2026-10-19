import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from './enums.js';
import {
  ORDER_TRANSITIONS,
  canUploadReceipt,
  checkTransition,
  customerCanCancel,
  findTransition,
  orderTimeline,
  staffTransitionsFrom,
  type OrderStateSnapshot,
  type TransitionActor,
} from './order-status.js';
import type { Permission } from './permissions.js';

const admin: TransitionActor = { type: 'staff', user: { role: 'ADMIN', permissions: [] } };
const customer: TransitionActor = { type: 'customer' };
const staff = (...permissions: Permission[]): TransitionActor => ({ type: 'staff', user: { role: 'STAFF', permissions } });

/** An order that satisfies every condition, so only the transition itself is under test. */
function order(overrides: Partial<OrderStateSnapshot> = {}): OrderStateSnapshot {
  return {
    status: 'NEW',
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    riderId: 'rider-1',
    receipts: [],
    ...overrides,
  };
}

const REASON = { reason: 'Customer asked to cancel' };

/** SPEC §6.7, one row per allowed transition. */
const ALLOWED: {
  from: OrderStatus;
  to: OrderStatus;
  permission: Permission;
  customerAllowed: boolean;
  requiresReason: boolean;
  restock: 'CANCEL' | 'RETURN' | null;
}[] = [
  { from: 'NEW', to: 'CONFIRMED', permission: 'orders.update_status', customerAllowed: false, requiresReason: false, restock: null },
  { from: 'CONFIRMED', to: 'DISPATCHED', permission: 'orders.update_status', customerAllowed: false, requiresReason: false, restock: null },
  { from: 'DISPATCHED', to: 'DELIVERED', permission: 'orders.update_status', customerAllowed: false, requiresReason: false, restock: null },
  { from: 'NEW', to: 'CANCELLED', permission: 'orders.cancel', customerAllowed: true, requiresReason: true, restock: 'CANCEL' },
  { from: 'CONFIRMED', to: 'CANCELLED', permission: 'orders.cancel', customerAllowed: false, requiresReason: true, restock: 'CANCEL' },
  { from: 'DELIVERED', to: 'RETURNED', permission: 'orders.cancel', customerAllowed: false, requiresReason: false, restock: 'RETURN' },
];

const isAllowed = (from: OrderStatus, to: OrderStatus) => ALLOWED.some((t) => t.from === from && t.to === to);
const BLOCKED: [OrderStatus, OrderStatus][] = ORDER_STATUSES.flatMap((from) =>
  ORDER_STATUSES.filter((to) => !isAllowed(from, to)).map((to): [OrderStatus, OrderStatus] => [from, to]),
);

describe('ORDER_TRANSITIONS table (SPEC §6.7)', () => {
  it('has exactly the six transitions from the spec', () => {
    expect(ORDER_TRANSITIONS).toHaveLength(ALLOWED.length);
    expect(BLOCKED).toHaveLength(36 - 6);
  });

  it.each(ALLOWED)('$from → $to needs $permission', (expected) => {
    expect(findTransition(expected.from, expected.to)).toMatchObject(expected);
  });

  it('gives every transition an action label and a done label', () => {
    for (const transition of ORDER_TRANSITIONS) {
      expect(transition.actionLabel).not.toBe('');
      expect(transition.doneLabel).not.toBe('');
    }
  });
});

describe('checkTransition: allowed transitions', () => {
  it.each(ALLOWED)('ADMIN may move $from → $to', ({ from, to }) => {
    const result = checkTransition(order({ status: from }), to, admin, REASON);
    expect(result).toMatchObject({ ok: true, transition: { from, to } });
  });

  it.each(ALLOWED)('STAFF with $permission may move $from → $to', ({ from, to, permission }) => {
    const result = checkTransition(order({ status: from }), to, staff('orders.view', permission), REASON);
    expect(result.ok).toBe(true);
  });
});

describe('checkTransition: every other pair is INVALID_TRANSITION', () => {
  it.each(BLOCKED)('%s → %s', (from, to) => {
    expect(findTransition(from, to)).toBeNull();
    for (const actor of [admin, customer]) {
      const result = checkTransition(order({ status: from, paymentStatus: 'PAID' }), to, actor, REASON);
      expect(result).toMatchObject({ ok: false, code: 'INVALID_TRANSITION' });
    }
  });

  it('explains the blocked change in plain words', () => {
    const result = checkTransition(order({ status: 'DELIVERED' }), 'CANCELLED', admin, REASON);
    expect(result).toEqual({
      ok: false,
      code: 'INVALID_TRANSITION',
      message: "An order that is delivered can't be changed to cancelled.",
    });
  });
});

describe('checkTransition: conditions', () => {
  it.each(PAYMENT_STATUSES.filter((s) => s !== 'PAID'))(
    'blocks confirming a bank transfer order while payment is %s',
    (paymentStatus) => {
      const result = checkTransition(order({ paymentMethod: 'BANK_TRANSFER', paymentStatus }), 'CONFIRMED', admin);
      expect(result).toMatchObject({ ok: false, code: 'INVALID_TRANSITION' });
    },
  );

  it('confirms a bank transfer order once it is PAID', () => {
    const result = checkTransition(order({ paymentMethod: 'BANK_TRANSFER', paymentStatus: 'PAID' }), 'CONFIRMED', admin);
    expect(result.ok).toBe(true);
  });

  it('confirms a COD order while payment is still pending', () => {
    const result = checkTransition(order({ paymentMethod: 'COD', paymentStatus: 'PENDING' }), 'CONFIRMED', admin);
    expect(result.ok).toBe(true);
  });

  it.each([null, undefined, ''])('blocks dispatch without a rider (riderId %j)', (riderId) => {
    const result = checkTransition(order({ status: 'CONFIRMED', riderId }), 'DISPATCHED', admin);
    expect(result).toEqual({
      ok: false,
      code: 'INVALID_TRANSITION',
      message: 'Assign a rider before marking the order dispatched.',
    });
  });

  const cancels: [OrderStatus, TransitionActor][] = [
    ['NEW', admin],
    ['CONFIRMED', admin],
    ['NEW', customer],
  ];
  it.each(cancels)('requires a cancel reason for %s → CANCELLED', (status, actor) => {
    for (const reason of [undefined, null, '', '   ']) {
      const result = checkTransition(order({ status }), 'CANCELLED', actor, { reason });
      expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    }
    expect(checkTransition(order({ status }), 'CANCELLED', actor).ok).toBe(false);
    expect(checkTransition(order({ status }), 'CANCELLED', actor, REASON).ok).toBe(true);
  });

  it('does not require a reason to mark an order returned', () => {
    expect(checkTransition(order({ status: 'DELIVERED' }), 'RETURNED', admin).ok).toBe(true);
  });
});

describe('checkTransition: customer cancel', () => {
  it('lets the customer cancel a NEW order with a reason', () => {
    expect(checkTransition(order(), 'CANCELLED', customer, REASON)).toMatchObject({
      ok: true,
      transition: { from: 'NEW', to: 'CANCELLED', restock: 'CANCEL' },
      paymentStatusAfter: 'PENDING',
    });
  });

  it('allows it while receipts are only pending or rejected', () => {
    const receipts = [{ status: 'pending' }, { status: 'rejected' }] as const;
    const result = checkTransition(
      order({ paymentMethod: 'BANK_TRANSFER', paymentStatus: 'AWAITING_VERIFICATION', receipts }),
      'CANCELLED',
      customer,
      REASON,
    );
    expect(result.ok).toBe(true);
  });

  it('blocks it once a receipt is approved', () => {
    const receipts = [{ status: 'rejected' }, { status: 'approved' }] as const;
    const result = checkTransition(
      order({ paymentMethod: 'BANK_TRANSFER', paymentStatus: 'PAID', receipts }),
      'CANCELLED',
      customer,
      REASON,
    );
    expect(result).toMatchObject({ ok: false, code: 'INVALID_TRANSITION' });
  });

  it.each(ORDER_STATUSES.filter((s) => s !== 'NEW'))('never lets the customer cancel a %s order', (status) => {
    const result = checkTransition(order({ status }), 'CANCELLED', customer, REASON);
    expect(result).toMatchObject({ ok: false, code: 'INVALID_TRANSITION' });
  });

  it.each(ALLOWED.filter((t) => !t.customerAllowed))('never lets the customer move $from → $to', ({ from, to }) => {
    const result = checkTransition(order({ status: from, paymentStatus: 'PAID' }), to, customer, REASON);
    expect(result.ok).toBe(false);
  });
});

describe('checkTransition: staff permissions', () => {
  it('returns FORBIDDEN when the staff member lacks the transition permission', () => {
    const updater = staff('orders.view', 'orders.update_status');
    const canceller = staff('orders.view', 'orders.cancel');

    expect(checkTransition(order(), 'CONFIRMED', updater).ok).toBe(true);
    expect(checkTransition(order(), 'CANCELLED', updater, REASON)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(checkTransition(order({ status: 'DELIVERED' }), 'RETURNED', updater)).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });

    expect(checkTransition(order(), 'CANCELLED', canceller, REASON).ok).toBe(true);
    expect(checkTransition(order(), 'CONFIRMED', canceller)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(checkTransition(order({ status: 'DISPATCHED' }), 'DELIVERED', canceller)).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });

  it('returns FORBIDDEN for staff without any permission and for a CUSTOMER posing as staff', () => {
    expect(checkTransition(order(), 'CONFIRMED', staff())).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    const forged: TransitionActor = {
      type: 'staff',
      user: { role: 'CUSTOMER', permissions: ['orders.view', 'orders.update_status', 'orders.cancel'] },
    };
    expect(checkTransition(order(), 'CONFIRMED', forged)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(checkTransition(order(), 'CANCELLED', forged, REASON)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('lets ADMIN make every change without listed permissions', () => {
    for (const { from, to } of ALLOWED) {
      expect(checkTransition(order({ status: from }), to, admin, REASON).ok).toBe(true);
    }
  });
});

describe('checkTransition: payment status after the change', () => {
  it('refunds a PAID order that is returned', () => {
    const result = checkTransition(order({ status: 'DELIVERED', paymentStatus: 'PAID' }), 'RETURNED', admin);
    expect(result).toMatchObject({ ok: true, paymentStatusAfter: 'REFUNDED' });
  });

  it.each(PAYMENT_STATUSES.filter((s) => s !== 'PAID'))('keeps %s on a returned order', (paymentStatus) => {
    const result = checkTransition(order({ status: 'DELIVERED', paymentStatus }), 'RETURNED', admin);
    expect(result).toMatchObject({ ok: true, paymentStatusAfter: paymentStatus });
  });

  it.each(ALLOWED.filter((t) => t.to !== 'RETURNED'))('never changes payment status on $from → $to', ({ from, to }) => {
    for (const paymentStatus of ['PENDING', 'PAID'] satisfies PaymentStatus[]) {
      const result = checkTransition(order({ status: from, paymentStatus }), to, admin, REASON);
      expect(result).toMatchObject({ ok: true, paymentStatusAfter: paymentStatus });
    }
  });
});

describe('staffTransitionsFrom', () => {
  const targets = (status: OrderStatus, actor: TransitionActor) =>
    actor.type === 'staff' ? staffTransitionsFrom(status, actor.user).map((t) => t.to) : [];

  it('lists what ADMIN can do from each status', () => {
    expect(targets('NEW', admin)).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(targets('CONFIRMED', admin)).toEqual(['DISPATCHED', 'CANCELLED']);
    expect(targets('DISPATCHED', admin)).toEqual(['DELIVERED']);
    expect(targets('DELIVERED', admin)).toEqual(['RETURNED']);
    expect(targets('CANCELLED', admin)).toEqual([]);
    expect(targets('RETURNED', admin)).toEqual([]);
  });

  it('filters by the staff member’s permissions', () => {
    expect(targets('NEW', staff('orders.view', 'orders.update_status'))).toEqual(['CONFIRMED']);
    expect(targets('CONFIRMED', staff('orders.view', 'orders.cancel'))).toEqual(['CANCELLED']);
    expect(targets('NEW', staff('orders.view'))).toEqual([]);
  });

  it('gives a CUSTOMER nothing', () => {
    expect(staffTransitionsFrom('NEW', { role: 'CUSTOMER', permissions: ['orders.cancel'] })).toEqual([]);
  });
});

describe('customerCanCancel', () => {
  it('is true only for a NEW order without an approved receipt', () => {
    expect(customerCanCancel({ status: 'NEW', receipts: [] })).toBe(true);
    expect(customerCanCancel({ status: 'NEW', receipts: [{ status: 'pending' }, { status: 'rejected' }] })).toBe(true);
    expect(customerCanCancel({ status: 'NEW', receipts: [{ status: 'approved' }] })).toBe(false);
    expect(customerCanCancel({ status: 'NEW', receipts: [{ status: 'rejected' }, { status: 'approved' }] })).toBe(false);
  });

  it.each(ORDER_STATUSES.filter((s) => s !== 'NEW'))('is false for a %s order', (status) => {
    expect(customerCanCancel({ status, receipts: [] })).toBe(false);
  });

  it('agrees with checkTransition for the customer', () => {
    for (const status of ORDER_STATUSES) {
      for (const receipts of [[], [{ status: 'approved' as const }]]) {
        const allowed = checkTransition(order({ status, receipts }), 'CANCELLED', customer, REASON).ok;
        expect(customerCanCancel({ status, receipts })).toBe(allowed);
      }
    }
  });
});

describe('canUploadReceipt (SPEC §6.8)', () => {
  const bank = (overrides: Partial<OrderStateSnapshot> = {}) =>
    order({ paymentMethod: 'BANK_TRANSFER', paymentStatus: 'PENDING', ...overrides });

  it('allows uploads on NEW and CONFIRMED bank transfer orders that are not paid', () => {
    expect(canUploadReceipt(bank(), 3)).toBe(true);
    expect(canUploadReceipt(bank({ status: 'CONFIRMED', paymentStatus: 'AWAITING_VERIFICATION' }), 3)).toBe(true);
    expect(canUploadReceipt(bank({ paymentStatus: 'REJECTED', receipts: [{ status: 'rejected' }] }), 3)).toBe(true);
  });

  it.each(['DISPATCHED', 'DELIVERED', 'CANCELLED', 'RETURNED'] satisfies OrderStatus[])(
    'blocks uploads on a %s order',
    (status) => {
      expect(canUploadReceipt(bank({ status }), 3)).toBe(false);
    },
  );

  it('blocks uploads once paid, and on COD orders', () => {
    expect(canUploadReceipt(bank({ paymentStatus: 'PAID' }), 3)).toBe(false);
    expect(canUploadReceipt(order({ paymentMethod: 'COD' }), 3)).toBe(false);
  });

  it('allows at most 3 pending receipts at once; rejected ones do not count', () => {
    const pending = (n: number) => Array.from({ length: n }, () => ({ status: 'pending' as const }));
    expect(canUploadReceipt(bank({ paymentStatus: 'AWAITING_VERIFICATION', receipts: pending(2) }), 3)).toBe(true);
    expect(canUploadReceipt(bank({ paymentStatus: 'AWAITING_VERIFICATION', receipts: pending(3) }), 3)).toBe(false);
    const rejected = Array.from({ length: 5 }, () => ({ status: 'rejected' as const }));
    expect(canUploadReceipt(bank({ paymentStatus: 'REJECTED', receipts: rejected }), 3)).toBe(true);
  });
});

describe('orderTimeline', () => {
  const at = (hour: number) => `2026-09-26T${String(hour).padStart(2, '0')}:00:00.000Z`;
  const summary = (steps: ReturnType<typeof orderTimeline>) => steps.map((s) => `${s.label}:${s.state}`);

  it('shows the happy path with the current step for a NEW order', () => {
    const steps = orderTimeline('NEW', [{ status: 'NEW', at: at(5) }]);
    expect(summary(steps)).toEqual(['Placed:current', 'Confirmed:upcoming', 'On the way:upcoming', 'Delivered:upcoming']);
    expect(steps.map((s) => s.at)).toEqual([at(5), null, null, null]);
  });

  it('marks earlier steps done and the current one current', () => {
    const steps = orderTimeline('DISPATCHED', [
      { status: 'NEW', at: at(5) },
      { status: 'CONFIRMED', at: at(6) },
      { status: 'DISPATCHED', at: at(7) },
    ]);
    expect(summary(steps)).toEqual(['Placed:done', 'Confirmed:done', 'On the way:current', 'Delivered:upcoming']);
    expect(steps[2]?.at).toBe(at(7));
  });

  it('marks every step done once delivered', () => {
    const history = (['NEW', 'CONFIRMED', 'DISPATCHED', 'DELIVERED'] as const).map((status, i) => ({
      status,
      at: new Date(at(5 + i)),
    }));
    const steps = orderTimeline('DELIVERED', history);
    expect(steps.every((s) => s.state === 'done')).toBe(true);
    expect(steps[3]?.at).toEqual(new Date(at(8)));
  });

  it('ends a cancelled order at the cancel step with the reason', () => {
    const steps = orderTimeline('CANCELLED', [
      { status: 'NEW', at: at(5) },
      { status: 'CANCELLED', at: at(6), note: 'Ordered by mistake' },
    ]);
    expect(summary(steps)).toEqual(['Placed:done', 'Cancelled:failed']);
    expect(steps[1]).toEqual({
      status: 'CANCELLED',
      label: 'Cancelled',
      state: 'failed',
      at: at(6),
      note: 'Ordered by mistake',
    });
  });

  it('keeps the steps reached before a cancel after confirmation', () => {
    const steps = orderTimeline('CANCELLED', [
      { status: 'NEW', at: at(5) },
      { status: 'CONFIRMED', at: at(6) },
      { status: 'CANCELLED', at: at(7) },
    ]);
    expect(summary(steps)).toEqual(['Placed:done', 'Confirmed:done', 'Cancelled:failed']);
  });

  it('shows the full path and a failed Returned step for a returned order', () => {
    const steps = orderTimeline('RETURNED', [
      { status: 'NEW', at: at(5) },
      { status: 'CONFIRMED', at: at(6) },
      { status: 'DISPATCHED', at: at(7) },
      { status: 'DELIVERED', at: at(8) },
      { status: 'RETURNED', at: at(9) },
    ]);
    expect(summary(steps)).toEqual([
      'Placed:done',
      'Confirmed:done',
      'On the way:done',
      'Delivered:done',
      'Returned:failed',
    ]);
  });

  it('copes with missing history', () => {
    const steps = orderTimeline('CANCELLED', []);
    expect(steps).toEqual([{ status: 'CANCELLED', label: 'Cancelled', state: 'failed', at: null, note: null }]);
  });
});
