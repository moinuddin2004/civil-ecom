import { effectivePermissions, PERMISSION_PRESETS, type Permission } from '@aricon/shared';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../common/errors/app-error.js';
import type { Principal } from './auth.types.js';
import { assertAuthorized } from './authorization.js';

function staff(role: 'ADMIN' | 'STAFF', permissions: readonly Permission[] = []): Principal {
  return {
    userId: 'u1',
    audience: 'admin',
    role,
    status: 'active',
    permissions: effectivePermissions({ role, permissions }),
    mustChangePassword: false,
    name: 'Sana',
    email: 'sana@aricon.com.pk',
    familyId: 'f1',
  };
}

function forbidden(fn: () => void): AppError {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('expected FORBIDDEN');
}

describe('assertAuthorized', () => {
  const orderManager = staff('STAFF', PERMISSION_PRESETS.orderManager.permissions);

  it('lets an admin through every staff policy', () => {
    const admin = staff('ADMIN');
    expect(() => assertAuthorized(admin, { kind: 'staff', allOf: ['products.edit_price', 'orders.cancel'] })).not.toThrow();
    expect(() => assertAuthorized(admin, { kind: 'staff', adminOnly: true })).not.toThrow();
  });

  it('requires every permission in allOf', () => {
    expect(() => assertAuthorized(orderManager, { kind: 'staff', allOf: ['orders.view', 'orders.update_status'] })).not.toThrow();
    const error = forbidden(() => assertAuthorized(orderManager, { kind: 'staff', allOf: ['orders.view', 'orders.cancel'] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(error.status).toBe(403);
  });

  it('requires at least one permission in anyOf', () => {
    expect(() => assertAuthorized(orderManager, { kind: 'staff', anyOf: ['products.view', 'orders.view'] })).not.toThrow();
    forbidden(() => assertAuthorized(orderManager, { kind: 'staff', anyOf: ['products.view', 'categories.manage'] }));
  });

  it('keeps admin-only areas closed to staff whatever their permissions (SPEC §4.3)', () => {
    const everything = staff('STAFF', effectivePermissions({ role: 'ADMIN', permissions: [] }));
    expect(forbidden(() => assertAuthorized(everything, { kind: 'staff', adminOnly: true })).message).toBe(
      'Only admins can do this.',
    );
  });

  it('allows any staff member when the policy names no permission', () => {
    expect(() => assertAuthorized(staff('STAFF'), { kind: 'staff' })).not.toThrow();
  });
});
