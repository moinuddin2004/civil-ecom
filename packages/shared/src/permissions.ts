import type { PermissionCatalogDTO } from "./dto/admin.js";
import type { Role } from "./enums.js";

/**
 * Staff permission catalog (SPEC §4.2). The admin UI (checkboxes, sidebar), the API
 * (`requirePermission`) and the seed scripts all read this list. ADMIN has every permission plus
 * the admin-only areas (staff, settings, audit logs), which have no checkbox (SPEC §4.3).
 */

export const PERMISSION_GROUPS = [
  "Dashboard",
  "Orders",
  "Products",
  "Catalog",
  "Customers",
  "Delivery",
  "Content",
  "Reports",
  "Stock",
] as const;
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

interface PermissionDefinition {
  readonly key: string;
  readonly group: PermissionGroup;
  readonly label: string;
  readonly dependsOn: readonly string[];
  readonly sensitive: boolean;
}

export const PERMISSIONS = [
  {
    key: "dashboard.view",
    group: "Dashboard",
    label: "View sales dashboard",
    dependsOn: [],
    sensitive: false,
  },
  {
    key: "orders.view",
    group: "Orders",
    label: "View orders and invoices",
    dependsOn: [],
    sensitive: false,
  },
  {
    key: "orders.create",
    group: "Orders",
    label: "Create orders for customers",
    dependsOn: ["orders.view", "customers.view"],
    sensitive: false,
  },
  {
    key: "orders.discount",
    group: "Orders",
    label: "Give a discount when creating an order",
    dependsOn: ["orders.view", "customers.view", "orders.create"],
    sensitive: true,
  },
  {
    key: "orders.update_status",
    group: "Orders",
    label: "Confirm, dispatch and deliver orders",
    dependsOn: ["orders.view"],
    sensitive: false,
  },
  {
    key: "orders.cancel",
    group: "Orders",
    label: "Cancel and return orders",
    dependsOn: ["orders.view"],
    sensitive: true,
  },
  {
    key: "orders.assign_rider",
    group: "Orders",
    label: "Assign riders",
    dependsOn: ["orders.view"],
    sensitive: false,
  },
  {
    key: "orders.cod_collect",
    group: "Orders",
    label: "Mark cash on delivery collected",
    dependsOn: ["orders.view"],
    sensitive: false,
  },
  {
    key: "orders.verify_payment",
    group: "Orders",
    label: "Approve or reject bank receipts",
    dependsOn: ["orders.view"],
    sensitive: false,
  },
  {
    key: "orders.export",
    group: "Orders",
    label: "Export orders to Excel",
    dependsOn: ["orders.view"],
    sensitive: false,
  },
  {
    key: "products.view",
    group: "Products",
    label: "View products",
    dependsOn: [],
    sensitive: false,
  },
  {
    key: "products.create",
    group: "Products",
    label: "Create products",
    dependsOn: ["products.view"],
    sensitive: false,
  },
  {
    key: "products.edit",
    group: "Products",
    label: "Edit product details and images",
    dependsOn: ["products.view"],
    sensitive: false,
  },
  {
    key: "products.edit_price",
    group: "Products",
    label: "Change prices and bulk tiers",
    dependsOn: ["products.view"],
    sensitive: true,
  },
  {
    key: "products.edit_stock",
    group: "Products",
    label: "Adjust stock",
    dependsOn: ["products.view"],
    sensitive: true,
  },
  {
    key: "products.archive",
    group: "Products",
    label: "Hide and archive products",
    dependsOn: ["products.view"],
    sensitive: false,
  },
  {
    key: "products.import",
    group: "Products",
    label: "Import products from Excel",
    dependsOn: ["products.view"],
    sensitive: false,
  },
  {
    key: "products.export",
    group: "Products",
    label: "Export products to Excel",
    dependsOn: ["products.view"],
    sensitive: false,
  },
  {
    key: "categories.manage",
    group: "Catalog",
    label: "Manage categories",
    dependsOn: [],
    sensitive: false,
  },
  {
    key: "brands.manage",
    group: "Catalog",
    label: "Manage brands",
    dependsOn: [],
    sensitive: false,
  },
  {
    key: "customers.view",
    group: "Customers",
    label: "View customers",
    dependsOn: [],
    sensitive: false,
  },
  {
    key: "customers.block",
    group: "Customers",
    label: "Block and unblock customers",
    dependsOn: ["customers.view"],
    sensitive: false,
  },
  {
    key: "customers.delete",
    group: "Customers",
    label: "Delete and restore customer accounts",
    dependsOn: ["customers.view"],
    sensitive: true,
  },
  {
    key: "customers.export",
    group: "Customers",
    label: "Export customers to Excel",
    dependsOn: ["customers.view"],
    sensitive: true,
  },
  {
    key: "delivery_areas.manage",
    group: "Delivery",
    label: "Manage delivery areas and charges",
    dependsOn: [],
    sensitive: false,
  },
  {
    key: "riders.manage",
    group: "Delivery",
    label: "Manage riders",
    dependsOn: [],
    sensitive: false,
  },
  {
    key: "homepage.manage",
    group: "Content",
    label: "Manage homepage banners and featured products",
    dependsOn: [],
    sensitive: false,
  },
  {
    key: "reports.view",
    group: "Reports",
    label: "View reports",
    dependsOn: [],
    sensitive: false,
  },
  {
    key: "reports.export",
    group: "Reports",
    label: "Export reports to Excel",
    dependsOn: ["reports.view"],
    sensitive: false,
  },
  {
    key: "stock_movements.view",
    group: "Stock",
    label: "View stock history",
    dependsOn: [],
    sensitive: false,
  },
] as const satisfies readonly PermissionDefinition[];

export type Permission = (typeof PERMISSIONS)[number]["key"];
export type PermissionDef = (typeof PERMISSIONS)[number];

export const PERMISSION_KEYS: readonly Permission[] = PERMISSIONS.map(
  (p) => p.key,
);

const BY_KEY = new Map<string, PermissionDef>(
  PERMISSIONS.map((p) => [p.key, p]),
);

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && BY_KEY.has(value);
}

export function getPermission(key: Permission): PermissionDef {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Unknown permission: ${key}`);
  return def;
}

/** Sorts permissions into catalog order and removes duplicates. */
function inCatalogOrder(perms: Iterable<Permission>): Permission[] {
  const set = new Set(perms);
  return PERMISSION_KEYS.filter((key) => set.has(key));
}

/**
 * Adds every permission the given ones depend on (SPEC §4.5 rule 1), transitively.
 * Applied when saving permissions (API) and when ticking checkboxes (UI).
 */
export function withDependencies(perms: Iterable<Permission>): Permission[] {
  const result = new Set<Permission>();
  const visit = (key: Permission) => {
    if (result.has(key)) return;
    result.add(key);
    for (const dep of getPermission(key).dependsOn) visit(dep);
  };
  for (const key of perms) visit(key);
  return inCatalogOrder(result);
}

/** Permissions that (directly or indirectly) need `perm`. */
export function dependentsOf(perm: Permission): Permission[] {
  const result = new Set<Permission>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const def of PERMISSIONS) {
      if (result.has(def.key)) continue;
      const deps: readonly string[] = def.dependsOn;
      if (deps.some((dep) => dep === perm || result.has(dep as Permission))) {
        result.add(def.key);
        changed = true;
      }
    }
  }
  return inCatalogOrder(result);
}

/**
 * Removes `perm` and everything that needs it (UI: unticking a dependency unticks the
 * permissions that depend on it, SPEC §10.8).
 */
export function withoutPermission(
  perms: Iterable<Permission>,
  perm: Permission,
): Permission[] {
  const removed = new Set<Permission>([perm, ...dependentsOf(perm)]);
  return inCatalogOrder([...perms].filter((key) => !removed.has(key)));
}

/** Presets are UI shortcuts only; the database stores the resulting list (SPEC §4.4). */
export const PERMISSION_PRESETS = {
  orderManager: {
    label: "Order Manager",
    permissions: [
      "orders.view",
      "orders.create",
      "orders.update_status",
      "orders.assign_rider",
      "orders.cod_collect",
      "orders.verify_payment",
      "customers.view",
    ],
  },
  catalogManager: {
    label: "Catalog Manager",
    permissions: [
      "products.view",
      "products.create",
      "products.edit",
      "products.edit_price",
      "products.edit_stock",
      "products.archive",
      "products.import",
      "products.export",
      "categories.manage",
      "brands.manage",
      "stock_movements.view",
    ],
  },
  accountantViewer: {
    label: "Accountant / Viewer",
    permissions: [
      "dashboard.view",
      "reports.view",
      "reports.export",
      "orders.view",
    ],
  },
} as const satisfies Record<
  string,
  { label: string; permissions: readonly Permission[] }
>;

export type PermissionPresetKey = keyof typeof PERMISSION_PRESETS;

/** Permissions given to a new staff member unless the admin chooses otherwise (SPEC §4.4). */
export const DEFAULT_STAFF_PERMISSIONS: readonly Permission[] = [
  "orders.view",
  "orders.update_status",
];

export interface PermissionSubject {
  role: Role;
  permissions: readonly string[];
}

/** ADMIN → always true. STAFF → only listed permissions. CUSTOMER → never. */
export function hasPermission(
  user: PermissionSubject,
  perm: Permission,
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role !== "STAFF") return false;
  return user.permissions.includes(perm);
}

export function hasAnyPermission(
  user: PermissionSubject,
  perms: readonly Permission[],
): boolean {
  return perms.some((perm) => hasPermission(user, perm));
}

/** The permissions that apply to this user: all of them for ADMIN, known keys only for STAFF. */
export function effectivePermissions(user: PermissionSubject): Permission[] {
  if (user.role === "ADMIN") return [...PERMISSION_KEYS];
  if (user.role !== "STAFF") return [];
  return inCatalogOrder(user.permissions.filter(isPermission));
}

/** Catalog grouped for the permission checkboxes. */
export function permissionsByGroup(): {
  group: PermissionGroup;
  permissions: PermissionDef[];
}[] {
  return PERMISSION_GROUPS.map((group) => ({
    group,
    permissions: PERMISSIONS.filter((p) => p.group === group),
  }));
}

/** `GET /api/admin/permissions`: the catalog, presets and defaults the staff editor needs. */
export function permissionCatalog(): PermissionCatalogDTO {
  return {
    groups: permissionsByGroup().map(({ group, permissions }) => ({
      group,
      permissions: permissions.map((p) => ({
        key: p.key,
        label: p.label,
        dependsOn: p.dependsOn.filter(isPermission),
        sensitive: p.sensitive,
      })),
    })),
    presets: Object.entries(PERMISSION_PRESETS).map(([key, preset]) => ({
      key,
      label: preset.label,
      permissions: [...preset.permissions],
    })),
    defaultStaffPermissions: withDependencies(DEFAULT_STAFF_PERMISSIONS),
  };
}
