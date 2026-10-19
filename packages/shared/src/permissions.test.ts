import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STAFF_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PERMISSION_PRESETS,
  dependentsOf,
  effectivePermissions,
  getPermission,
  hasAnyPermission,
  hasPermission,
  isPermission,
  permissionCatalog,
  permissionsByGroup,
  withDependencies,
  withoutPermission,
  type Permission,
} from './permissions.js';

/** SPEC §4.2, row by row: key, group, label, dependsOn, sensitive. */
const SPEC_CATALOG: [string, string, string, string[], boolean][] = [
  ['dashboard.view', 'Dashboard', 'View sales dashboard', [], false],
  ['orders.view', 'Orders', 'View orders and invoices', [], false],
  ['orders.update_status', 'Orders', 'Confirm, dispatch and deliver orders', ['orders.view'], false],
  ['orders.cancel', 'Orders', 'Cancel and return orders', ['orders.view'], true],
  ['orders.assign_rider', 'Orders', 'Assign riders', ['orders.view'], false],
  ['orders.cod_collect', 'Orders', 'Mark cash on delivery collected', ['orders.view'], false],
  ['orders.verify_payment', 'Orders', 'Approve or reject bank receipts', ['orders.view'], false],
  ['orders.export', 'Orders', 'Export orders to Excel', ['orders.view'], false],
  ['products.view', 'Products', 'View products', [], false],
  ['products.create', 'Products', 'Create products', ['products.view'], false],
  ['products.edit', 'Products', 'Edit product details and images', ['products.view'], false],
  ['products.edit_price', 'Products', 'Change prices and bulk tiers', ['products.view'], true],
  ['products.edit_stock', 'Products', 'Adjust stock', ['products.view'], true],
  ['products.archive', 'Products', 'Hide and archive products', ['products.view'], false],
  ['products.import', 'Products', 'Import products from Excel', ['products.view'], false],
  ['products.export', 'Products', 'Export products to Excel', ['products.view'], false],
  ['categories.manage', 'Catalog', 'Manage categories', [], false],
  ['brands.manage', 'Catalog', 'Manage brands', [], false],
  ['customers.view', 'Customers', 'View customers', [], false],
  ['customers.block', 'Customers', 'Block and unblock customers', ['customers.view'], false],
  ['customers.export', 'Customers', 'Export customers to Excel', ['customers.view'], true],
  ['delivery_areas.manage', 'Delivery', 'Manage delivery areas and charges', [], false],
  ['riders.manage', 'Delivery', 'Manage riders', [], false],
  ['homepage.manage', 'Content', 'Manage homepage banners and featured products', [], false],
  ['reports.view', 'Reports', 'View reports', [], false],
  ['reports.export', 'Reports', 'Export reports to Excel', ['reports.view'], false],
  ['stock_movements.view', 'Stock', 'View stock history', [], false],
];

const staff = (...permissions: string[]) => ({ role: 'STAFF' as const, permissions });

describe('permission catalog (SPEC §4.2)', () => {
  it('matches the spec table exactly, in order', () => {
    expect(
      PERMISSIONS.map((p) => [p.key, p.group, p.label, [...p.dependsOn], p.sensitive]),
    ).toEqual(SPEC_CATALOG);
    expect(PERMISSION_KEYS).toEqual(SPEC_CATALOG.map(([key]) => key));
  });

  it('has unique keys and only depends on keys in the catalog, without cycles', () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    for (const def of PERMISSIONS) {
      for (const dep of def.dependsOn) {
        expect(isPermission(dep)).toBe(true);
        expect(dep).not.toBe(def.key);
      }
    }
  });

  it('does not contain the admin-only areas (SPEC §4.3)', () => {
    for (const key of PERMISSION_KEYS) {
      expect(key).not.toMatch(/^(staff|settings|audit|roles|permissions)/);
    }
  });

  it('looks up definitions by key', () => {
    expect(getPermission('orders.cancel')).toMatchObject({ group: 'Orders', sensitive: true });
    expect(() => getPermission('settings.manage' as string as Permission)).toThrow();
  });
});

describe('isPermission', () => {
  it('accepts catalog keys only', () => {
    expect(isPermission('orders.view')).toBe(true);
    for (const value of ['ORDERS.VIEW', 'orders.view ', '', 'orders', 'toString', '__proto__', 'settings.manage', 42, null, undefined, {}]) {
      expect(isPermission(value)).toBe(false);
    }
  });
});

describe('withDependencies (SPEC §4.5 rule 1)', () => {
  it('adds what a permission depends on', () => {
    expect(withDependencies(['orders.cancel'])).toEqual(['orders.view', 'orders.cancel']);
    expect(withDependencies(['customers.export'])).toEqual(['customers.view', 'customers.export']);
  });

  it('returns catalog order regardless of input order', () => {
    expect(withDependencies(['reports.export', 'products.edit_price', 'dashboard.view'])).toEqual([
      'dashboard.view',
      'products.view',
      'products.edit_price',
      'reports.view',
      'reports.export',
    ]);
  });

  it('removes duplicates', () => {
    expect(withDependencies(['orders.view', 'orders.update_status', 'orders.view', 'orders.update_status'])).toEqual([
      'orders.view',
      'orders.update_status',
    ]);
  });

  it('handles empty input and any iterable', () => {
    expect(withDependencies([])).toEqual([]);
    expect(withDependencies(new Set<Permission>(['products.import']))).toEqual(['products.view', 'products.import']);
  });

  it('returns a list closed under dependsOn (transitive) for every single permission', () => {
    for (const key of PERMISSION_KEYS) {
      const result = withDependencies([key]);
      expect(result).toContain(key);
      for (const granted of result) {
        for (const dep of getPermission(granted).dependsOn) expect(result).toContain(dep);
      }
    }
  });

  it('is idempotent and keeps the full catalog unchanged', () => {
    const once = withDependencies(['orders.export', 'customers.block']);
    expect(withDependencies(once)).toEqual(once);
    expect(withDependencies(PERMISSION_KEYS)).toEqual([...PERMISSION_KEYS]);
  });
});

describe('dependentsOf and withoutPermission (unticking, SPEC §10.8)', () => {
  it('lists everything that needs a permission, in catalog order', () => {
    expect(dependentsOf('orders.view')).toEqual([
      'orders.update_status',
      'orders.cancel',
      'orders.assign_rider',
      'orders.cod_collect',
      'orders.verify_payment',
      'orders.export',
    ]);
    expect(dependentsOf('products.view')).toEqual([
      'products.create',
      'products.edit',
      'products.edit_price',
      'products.edit_stock',
      'products.archive',
      'products.import',
      'products.export',
    ]);
    expect(dependentsOf('customers.view')).toEqual(['customers.block', 'customers.export']);
    expect(dependentsOf('reports.view')).toEqual(['reports.export']);
  });

  it('is empty for permissions nothing depends on', () => {
    expect(dependentsOf('orders.cancel')).toEqual([]);
    expect(dependentsOf('dashboard.view')).toEqual([]);
    expect(dependentsOf('stock_movements.view')).toEqual([]);
  });

  it('is the exact inverse of dependsOn', () => {
    for (const key of PERMISSION_KEYS) {
      const expected = PERMISSIONS.filter((p) => (p.dependsOn as readonly string[]).includes(key)).map((p) => p.key);
      expect(dependentsOf(key)).toEqual(expected);
    }
  });

  it('removes a permission together with everything that needs it', () => {
    const current: Permission[] = ['customers.view', 'orders.cancel', 'orders.view', 'orders.update_status'];
    expect(withoutPermission(current, 'orders.view')).toEqual(['customers.view']);
    expect(withoutPermission(current, 'orders.cancel')).toEqual(['orders.view', 'orders.update_status', 'customers.view']);
  });

  it('leaves the list (sorted, deduplicated) when the permission is not there', () => {
    expect(withoutPermission(['reports.view', 'dashboard.view', 'reports.view'], 'orders.view')).toEqual([
      'dashboard.view',
      'reports.view',
    ]);
  });

  it('never leaves a permission without its dependency', () => {
    for (const removed of PERMISSION_KEYS) {
      const result = withoutPermission(PERMISSION_KEYS, removed);
      expect(withDependencies(result)).toEqual(result);
      expect(result).not.toContain(removed);
    }
  });
});

describe('presets (SPEC §4.4)', () => {
  it('match the spec lists', () => {
    expect(new Set(PERMISSION_PRESETS.orderManager.permissions)).toEqual(
      new Set([
        'orders.view',
        'orders.update_status',
        'orders.assign_rider',
        'orders.cod_collect',
        'orders.verify_payment',
        'customers.view',
      ]),
    );
    expect(new Set(PERMISSION_PRESETS.catalogManager.permissions)).toEqual(
      new Set([
        ...PERMISSION_KEYS.filter((key) => key.startsWith('products.')),
        'categories.manage',
        'brands.manage',
        'stock_movements.view',
      ]),
    );
    expect(new Set(PERMISSION_PRESETS.accountantViewer.permissions)).toEqual(
      new Set(['dashboard.view', 'reports.view', 'reports.export', 'orders.view']),
    );
    expect(Object.keys(PERMISSION_PRESETS)).toEqual(['orderManager', 'catalogManager', 'accountantViewer']);
  });

  it('use only valid keys, without duplicates, and already include their dependencies', () => {
    for (const preset of Object.values(PERMISSION_PRESETS)) {
      for (const key of preset.permissions) expect(isPermission(key)).toBe(true);
      expect(new Set(preset.permissions).size).toBe(preset.permissions.length);
      expect(new Set(withDependencies(preset.permissions))).toEqual(new Set(preset.permissions));
    }
  });

  it('give new staff orders.view and orders.update_status by default', () => {
    expect([...DEFAULT_STAFF_PERMISSIONS]).toEqual(['orders.view', 'orders.update_status']);
    expect(withDependencies(DEFAULT_STAFF_PERMISSIONS)).toEqual([...DEFAULT_STAFF_PERMISSIONS]);
  });
});

describe('hasPermission (SPEC §4.1)', () => {
  it('always grants ADMIN, even with an empty list', () => {
    for (const key of PERMISSION_KEYS) {
      expect(hasPermission({ role: 'ADMIN', permissions: [] }, key)).toBe(true);
    }
  });

  it('grants STAFF only the listed permissions', () => {
    const user = staff('orders.view', 'orders.update_status');
    expect(hasPermission(user, 'orders.view')).toBe(true);
    expect(hasPermission(user, 'orders.update_status')).toBe(true);
    expect(hasPermission(user, 'orders.cancel')).toBe(false);
    expect(hasPermission(user, 'products.edit_price')).toBe(false);
    expect(hasPermission(staff(), 'orders.view')).toBe(false);
  });

  it('does not infer a dependency the list does not contain', () => {
    expect(hasPermission(staff('orders.cancel'), 'orders.view')).toBe(false);
  });

  it('never grants a CUSTOMER, whatever the stored list says', () => {
    const forged = { role: 'CUSTOMER' as const, permissions: [...PERMISSION_KEYS] };
    for (const key of PERMISSION_KEYS) expect(hasPermission(forged, key)).toBe(false);
  });

  it('hasAnyPermission is true when one of the permissions is held', () => {
    expect(hasAnyPermission(staff('orders.assign_rider'), ['riders.manage', 'orders.assign_rider'])).toBe(true);
    expect(hasAnyPermission(staff('orders.view'), ['riders.manage', 'orders.assign_rider'])).toBe(false);
    expect(hasAnyPermission({ role: 'ADMIN', permissions: [] }, ['riders.manage'])).toBe(true);
    expect(hasAnyPermission({ role: 'CUSTOMER', permissions: ['riders.manage'] }, ['riders.manage'])).toBe(false);
  });
});

describe('effectivePermissions', () => {
  it('gives ADMIN the whole catalog as a fresh array', () => {
    const perms = effectivePermissions({ role: 'ADMIN', permissions: [] });
    expect(perms).toEqual([...PERMISSION_KEYS]);
    perms.pop();
    expect(effectivePermissions({ role: 'ADMIN', permissions: [] })).toHaveLength(PERMISSION_KEYS.length);
  });

  it('drops unknown keys and duplicates for STAFF and returns catalog order', () => {
    expect(
      effectivePermissions(staff('reports.view', 'bogus.key', 'orders.view', 'settings.manage', 'orders.view', 'ORDERS.VIEW')),
    ).toEqual(['orders.view', 'reports.view']);
  });

  it('gives a CUSTOMER nothing', () => {
    expect(effectivePermissions({ role: 'CUSTOMER', permissions: ['orders.view'] })).toEqual([]);
  });
});

describe('permissionsByGroup', () => {
  it('lists every permission once, grouped in group order', () => {
    const groups = permissionsByGroup();
    expect(groups.map((g) => g.group)).toEqual([...PERMISSION_GROUPS]);
    expect(groups.flatMap((g) => g.permissions.map((p) => p.key))).toEqual([...PERMISSION_KEYS]);
    for (const { group, permissions } of groups) {
      expect(permissions.length).toBeGreaterThan(0);
      for (const p of permissions) expect(p.group).toBe(group);
    }
  });
});

describe('permissionCatalog (GET /api/admin/permissions)', () => {
  it('lists every permission once, grouped, with presets and dependency-complete defaults', () => {
    const catalog = permissionCatalog();
    const keys = catalog.groups.flatMap((group) => group.permissions.map((p) => p.key));
    expect([...keys].sort()).toEqual([...PERMISSION_KEYS].sort());
    expect(catalog.presets.map((preset) => preset.key)).toEqual(Object.keys(PERMISSION_PRESETS));
    expect(catalog.defaultStaffPermissions).toEqual(withDependencies(catalog.defaultStaffPermissions));
  });
});
