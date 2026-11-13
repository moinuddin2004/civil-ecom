import type { AdminMeDTO, Permission } from '@aricon/shared';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  FileClock,
  FolderTree,
  History,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Package,
  Settings,
  ShoppingBag,
  Tag,
  Truck,
  Upload,
  Users,
} from 'lucide-react';

export interface AdminNavItem {
  label: string;
  /** One line shown as the tooltip, so each item says what it is for. */
  description: string;
  href: string;
  icon: LucideIcon;
  visible: (me: AdminMeDTO) => boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

const can = (me: AdminMeDTO, permission: Permission) => me.permissions.includes(permission);

/**
 * Sidebar sections and the permission each item needs (SPEC §10.2). Items are grouped by the job
 * they belong to; a section with nothing the signed-in staff member may open is not shown.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', description: 'Sales today, orders to act on and low stock', href: '/admin', icon: LayoutDashboard, visible: () => true },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Orders', description: 'Create, confirm, dispatch and track orders', href: '/admin/orders', icon: ShoppingBag, visible: (me) => can(me, 'orders.view') },
      { label: 'Reports', description: 'Revenue, cash collected and best sellers', href: '/admin/reports', icon: BarChart3, visible: (me) => can(me, 'reports.view') },
      {
        label: 'Users',
        description: 'Customers and staff accounts',
        href: '/admin/users',
        icon: Users,
        visible: (me) => me.user.role === 'ADMIN' || can(me, 'customers.view'),
      },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', description: 'Prices, bulk tiers, stock and photos', href: '/admin/products', icon: Package, visible: (me) => can(me, 'products.view') },
      { label: 'Categories', description: 'How products are grouped in the shop', href: '/admin/categories', icon: FolderTree, visible: (me) => can(me, 'categories.manage') },
      { label: 'Brands', description: 'Brands shown on products and filters', href: '/admin/brands', icon: Tag, visible: (me) => can(me, 'brands.manage') },
      { label: 'Stock history', description: 'Every stock change and why it happened', href: '/admin/stock-movements', icon: History, visible: (me) => can(me, 'stock_movements.view') },
      { label: 'Import', description: 'Add or update many products from Excel', href: '/admin/products/import', icon: Upload, visible: (me) => can(me, 'products.import') },
    ],
  },
  {
    label: 'Store',
    items: [
      { label: 'Homepage', description: 'Banners, deals and featured products', href: '/admin/homepage', icon: LayoutGrid, visible: (me) => can(me, 'homepage.manage') },
      { label: 'Delivery areas', description: 'Where you deliver and the delivery fee', href: '/admin/delivery-areas', icon: MapPin, visible: (me) => can(me, 'delivery_areas.manage') },
      { label: 'Riders', description: 'Delivery people you assign orders to', href: '/admin/riders', icon: Truck, visible: (me) => can(me, 'riders.manage') },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', description: 'Store details, payments and policies', href: '/admin/settings', icon: Settings, visible: (me) => me.user.role === 'ADMIN' },
      { label: 'Audit log', description: 'Who changed what, and when', href: '/admin/audit-logs', icon: FileClock, visible: (me) => me.user.role === 'ADMIN' },
    ],
  },
];

/** The sections with only the items this staff member may open; empty sections are dropped. */
export function visibleNavGroups(me: AdminMeDTO): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => item.visible(me)) })).filter(
    (group) => group.items.length > 0,
  );
}

/** Every item in order, for the compact mobile strip. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

/** Whether `href` is the page being shown (the longest matching item wins, so Import isn't also Products). */
export function isActive(pathname: string, href: string, allHrefs: readonly string[]): boolean {
  if (href === '/admin') return pathname === '/admin';
  if (pathname === href) return true;
  // `/admin/products/import` belongs to Import, not to Products: the longest matching item wins.
  if (!pathname.startsWith(`${href}/`)) return false;
  return !allHrefs.some((other) => other.length > href.length && (pathname === other || pathname.startsWith(`${other}/`)));
}
