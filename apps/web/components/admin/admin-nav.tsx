import type { AdminMeDTO } from '@aricon/shared';
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
  href: string;
  icon: LucideIcon;
  visible: (me: AdminMeDTO) => boolean;
}

/** Sidebar items and the permission each needs (SPEC §10.2). */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, visible: () => true },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingBag, visible: (me) => me.permissions.includes('orders.view') },
  { label: 'Products', href: '/admin/products', icon: Package, visible: (me) => me.permissions.includes('products.view') },
  { label: 'Import', href: '/admin/products/import', icon: Upload, visible: (me) => me.permissions.includes('products.import') },
  { label: 'Stock history', href: '/admin/stock-movements', icon: History, visible: (me) => me.permissions.includes('stock_movements.view') },
  { label: 'Categories', href: '/admin/categories', icon: FolderTree, visible: (me) => me.permissions.includes('categories.manage') },
  { label: 'Brands', href: '/admin/brands', icon: Tag, visible: (me) => me.permissions.includes('brands.manage') },
  { label: 'Users', href: '/admin/users', icon: Users, visible: (me) => me.user.role === 'ADMIN' || me.permissions.includes('customers.view') },
  { label: 'Delivery areas', href: '/admin/delivery-areas', icon: MapPin, visible: (me) => me.permissions.includes('delivery_areas.manage') },
  { label: 'Riders', href: '/admin/riders', icon: Truck, visible: (me) => me.permissions.includes('riders.manage') },
  { label: 'Homepage', href: '/admin/homepage', icon: LayoutGrid, visible: (me) => me.permissions.includes('homepage.manage') },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3, visible: (me) => me.permissions.includes('reports.view') },
  { label: 'Settings', href: '/admin/settings', icon: Settings, visible: (me) => me.user.role === 'ADMIN' },
  { label: 'Audit log', href: '/admin/audit-logs', icon: FileClock, visible: (me) => me.user.role === 'ADMIN' },
];
