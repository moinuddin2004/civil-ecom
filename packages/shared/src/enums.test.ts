import { describe, expect, it } from 'vitest';
import {
  AUDIT_ACTIONS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAGE_KEYS,
  PAGE_SLUGS,
  PAGE_TITLES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PRODUCT_SORTS,
  PRODUCT_STATUSES,
  RECEIPT_STATUSES,
  ROLES,
  STAFF_ROLES,
  STOCK_MOVEMENT_REASONS,
  UNITS,
  UNIT_LABELS,
  pageKeyFromSlug,
} from './enums.js';

describe('enums match the spec values (SPEC §5)', () => {
  it('roles', () => {
    expect([...ROLES]).toEqual(['ADMIN', 'STAFF', 'CUSTOMER']);
    expect([...STAFF_ROLES]).toEqual(['ADMIN', 'STAFF']);
  });

  it('order, payment and receipt statuses', () => {
    expect([...ORDER_STATUSES]).toEqual(['NEW', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'RETURNED']);
    expect([...PAYMENT_METHODS]).toEqual(['COD', 'BANK_TRANSFER']);
    expect([...PAYMENT_STATUSES]).toEqual(['PENDING', 'AWAITING_VERIFICATION', 'PAID', 'REJECTED', 'REFUNDED']);
    expect([...RECEIPT_STATUSES]).toEqual(['pending', 'approved', 'rejected']);
  });

  it('stock movement reasons and product statuses', () => {
    expect([...STOCK_MOVEMENT_REASONS]).toEqual(['ORDER', 'CANCEL', 'RETURN', 'ADJUST', 'IMPORT']);
    expect([...PRODUCT_STATUSES]).toEqual(['active', 'hidden', 'archived']);
    expect([...PRODUCT_SORTS]).toEqual(['relevance', 'price_asc', 'price_desc', 'newest']);
  });

  it('includes every unit from SPEC §5.6, each with labels', () => {
    for (const unit of ['bag', 'piece', 'sheet', 'litre', 'box', 'roll', 'metre', 'sqft', 'kg', 'set'] as const) {
      expect(UNITS).toContain(unit);
    }
    for (const unit of UNITS) {
      expect(UNIT_LABELS[unit].one).not.toBe('');
      expect(UNIT_LABELS[unit].many).not.toBe('');
    }
  });

  it('labels every order status', () => {
    for (const status of ORDER_STATUSES) expect(ORDER_STATUS_LABELS[status]).not.toBe('');
  });

  it('includes the audit actions named in SPEC §5.16', () => {
    for (const action of [
      'product.price_changed',
      'order.status_changed',
      'order.payment_approved',
      'user.role_changed',
      'user.permissions_changed',
      'user.blocked',
      'settings.updated',
      'stock.adjusted',
    ] as const) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
  });
});

describe('content pages (SPEC §5.14, §7.2)', () => {
  it('maps every page key to its URL key and back', () => {
    expect(PAGE_KEYS.map((key) => PAGE_SLUGS[key])).toEqual([
      'about',
      'faq',
      'contact',
      'refund-policy',
      'delivery-policy',
      'privacy-policy',
      'terms',
    ]);
    for (const key of PAGE_KEYS) {
      expect(pageKeyFromSlug(PAGE_SLUGS[key])).toBe(key);
      expect(PAGE_TITLES[key]).not.toBe('');
    }
  });

  it('rejects unknown and camelCase slugs', () => {
    expect(pageKeyFromSlug('refundPolicy')).toBeNull();
    expect(pageKeyFromSlug('shipping')).toBeNull();
    expect(pageKeyFromSlug('')).toBeNull();
    expect(pageKeyFromSlug('constructor')).toBeNull();
  });
});
