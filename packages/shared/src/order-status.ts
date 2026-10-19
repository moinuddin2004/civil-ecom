import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ReceiptStatus,
  StockMovementReason,
} from './enums.js';
import { ORDER_STATUS_LABELS } from './enums.js';
import { hasPermission, type Permission, type PermissionSubject } from './permissions.js';

/**
 * Order status machine (SPEC §6.7): the one table the API enforces and the UI uses to decide
 * which action buttons to show.
 */

export interface OrderTransition {
  from: OrderStatus;
  to: OrderStatus;
  /** Staff permission needed. */
  permission: Permission;
  /** The customer may make this change on their own order (subject to conditions). */
  customerAllowed: boolean;
  /** A cancel reason is required. */
  requiresReason: boolean;
  /** Stock is returned with this movement reason (inside a transaction). */
  restock: Extract<StockMovementReason, 'CANCEL' | 'RETURN'> | null;
  /** Button label in the admin order page. */
  actionLabel: string;
  /** Toast after success. */
  doneLabel: string;
}

export const ORDER_TRANSITIONS: readonly OrderTransition[] = [
  {
    from: 'NEW',
    to: 'CONFIRMED',
    permission: 'orders.update_status',
    customerAllowed: false,
    requiresReason: false,
    restock: null,
    actionLabel: 'Confirm order',
    doneLabel: 'Order confirmed',
  },
  {
    from: 'CONFIRMED',
    to: 'DISPATCHED',
    permission: 'orders.update_status',
    customerAllowed: false,
    requiresReason: false,
    restock: null,
    actionLabel: 'Mark dispatched',
    doneLabel: 'Order dispatched',
  },
  {
    from: 'DISPATCHED',
    to: 'DELIVERED',
    permission: 'orders.update_status',
    customerAllowed: false,
    requiresReason: false,
    restock: null,
    actionLabel: 'Mark delivered',
    doneLabel: 'Order delivered',
  },
  {
    from: 'NEW',
    to: 'CANCELLED',
    permission: 'orders.cancel',
    customerAllowed: true,
    requiresReason: true,
    restock: 'CANCEL',
    actionLabel: 'Cancel order',
    doneLabel: 'Order cancelled',
  },
  {
    from: 'CONFIRMED',
    to: 'CANCELLED',
    permission: 'orders.cancel',
    customerAllowed: false,
    requiresReason: true,
    restock: 'CANCEL',
    actionLabel: 'Cancel order',
    doneLabel: 'Order cancelled',
  },
  {
    from: 'DELIVERED',
    to: 'RETURNED',
    permission: 'orders.cancel',
    customerAllowed: false,
    requiresReason: false,
    restock: 'RETURN',
    actionLabel: 'Mark returned',
    doneLabel: 'Order marked returned',
  },
];

export function findTransition(from: OrderStatus, to: OrderStatus): OrderTransition | null {
  return ORDER_TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

/** The order fields the conditions look at. */
export interface OrderStateSnapshot {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  riderId: unknown;
  receipts: readonly { status: ReceiptStatus }[];
}

export type TransitionActor =
  | { type: 'staff'; user: PermissionSubject }
  | { type: 'customer' };

export type TransitionCheck =
  | { ok: true; transition: OrderTransition; paymentStatusAfter: PaymentStatus }
  | {
      ok: false;
      code: 'INVALID_TRANSITION' | 'FORBIDDEN' | 'VALIDATION_ERROR';
      message: string;
    };

/**
 * Checks whether `actor` may move `order` to `to` (SPEC §6.7 conditions), and what the payment
 * status becomes (a returned order that was paid becomes REFUNDED).
 */
export function checkTransition(
  order: OrderStateSnapshot,
  to: OrderStatus,
  actor: TransitionActor,
  options: { reason?: string | null } = {},
): TransitionCheck {
  const transition = findTransition(order.status, to);
  if (!transition) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `An order that is ${ORDER_STATUS_LABELS[order.status].toLowerCase()} can't be changed to ${ORDER_STATUS_LABELS[to].toLowerCase()}.`,
    };
  }

  if (actor.type === 'customer') {
    // The customer owns the order; what blocks them is its state (e.g. already confirmed), so this
    // is a 409 like any other disallowed transition (SPEC §6.7), not a 403.
    if (!transition.customerAllowed) {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        message: 'You can only cancel an order while it is new. Contact us on WhatsApp to cancel it.',
      };
    }
    if (order.receipts.some((receipt) => receipt.status === 'approved')) {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        message: 'Your payment has already been verified. Contact us on WhatsApp to cancel.',
      };
    }
  } else if (!hasPermission(actor.user, transition.permission)) {
    return { ok: false, code: 'FORBIDDEN', message: "You don't have permission to do this." };
  }

  if (transition.to === 'CONFIRMED' && order.paymentMethod === 'BANK_TRANSFER' && order.paymentStatus !== 'PAID') {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: 'Approve the bank transfer receipt before confirming this order.',
    };
  }

  if (transition.to === 'DISPATCHED' && !order.riderId) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: 'Assign a rider before marking the order dispatched.',
    };
  }

  if (transition.requiresReason && !options.reason?.trim()) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Give a reason for cancelling.' };
  }

  const paymentStatusAfter: PaymentStatus =
    transition.to === 'RETURNED' && order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus;

  return { ok: true, transition, paymentStatusAfter };
}

/**
 * Transitions this staff member can start from the current status, ignoring conditions such as
 * "rider assigned" (the UI shows those buttons and explains why they are blocked).
 */
export function staffTransitionsFrom(status: OrderStatus, user: PermissionSubject): OrderTransition[] {
  return ORDER_TRANSITIONS.filter((t) => t.from === status && hasPermission(user, t.permission));
}

/** Whether the customer may cancel the order themselves (SPEC §6.7). */
export function customerCanCancel(order: Pick<OrderStateSnapshot, 'status' | 'receipts'>): boolean {
  return order.status === 'NEW' && !order.receipts.some((receipt) => receipt.status === 'approved');
}

/** Whether a bank-transfer receipt can be uploaded now (SPEC §6.8). */
export function canUploadReceipt(
  order: Pick<OrderStateSnapshot, 'status' | 'paymentMethod' | 'paymentStatus' | 'receipts'>,
  maxPending: number,
): boolean {
  return (
    order.paymentMethod === 'BANK_TRANSFER' &&
    (order.status === 'NEW' || order.status === 'CONFIRMED') &&
    order.paymentStatus !== 'PAID' &&
    order.receipts.filter((receipt) => receipt.status === 'pending').length < maxPending
  );
}

export type TimelineStepState = 'done' | 'current' | 'upcoming' | 'failed';

export interface TimelineStep {
  status: OrderStatus;
  label: string;
  state: TimelineStepState;
  at: Date | string | null;
  note: string | null;
}

/**
 * Steps for the order status timeline: Placed → Confirmed → On the way → Delivered, or the path
 * so far ending in Cancelled / Returned.
 */
export function orderTimeline(
  status: OrderStatus,
  history: readonly { status: OrderStatus; at: Date | string; note?: string | null }[],
): TimelineStep[] {
  const reached = (s: OrderStatus) => history.find((h) => h.status === s);
  const labels: Record<OrderStatus, string> = { ...ORDER_STATUS_LABELS, NEW: 'Placed' };
  const happyPath: OrderStatus[] = ['NEW', 'CONFIRMED', 'DISPATCHED', 'DELIVERED'];

  if (status === 'CANCELLED' || status === 'RETURNED') {
    const steps: TimelineStep[] = happyPath
      .filter((s) => reached(s))
      .map((s) => ({ status: s, label: labels[s], state: 'done', at: reached(s)?.at ?? null, note: null }));
    const end = reached(status);
    steps.push({ status, label: labels[status], state: 'failed', at: end?.at ?? null, note: end?.note ?? null });
    return steps;
  }

  const currentIndex = happyPath.indexOf(status);
  return happyPath.map((s, index) => {
    const entry = reached(s);
    const state: TimelineStepState =
      index < currentIndex || (index === currentIndex && s === 'DELIVERED')
        ? 'done'
        : index === currentIndex
          ? 'current'
          : 'upcoming';
    return { status: s, label: labels[s], state, at: entry?.at ?? null, note: entry?.note ?? null };
  });
}
