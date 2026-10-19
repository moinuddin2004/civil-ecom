import {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '@aricon/shared';
import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { OrdersListView, type OrdersListFilters } from '@/components/admin/orders-list-view';
import { can, getAdminOrders, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Orders' };

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function param(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = sp[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
}

function oneOf<T extends string>(values: readonly T[], value: string | undefined): T | undefined {
  return (values as readonly string[]).includes(value ?? '') ? (value as T) : undefined;
}

/** The "Cancelled & returned" tab is both statuses; every other tab is one status or all. */
function statusesFor(tab: string): OrderStatus[] | undefined {
  if (tab === 'cancelled_returned') return ['CANCELLED', 'RETURNED'];
  const status = oneOf(ORDER_STATUSES, tab);
  return status ? [status] : undefined;
}

/**
 * Admin orders list (SPEC §10.4, DESIGN.md §9.3): status tabs with counts, a filter bar (payment
 * status/method, search by order number, name or phone — the top bar's search also lands here as
 * `?q=`) and a dense table. Filters live in the query string; the API filters, counts and pages.
 */
export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  const me = await requireStaff();
  if (!can(me, 'orders.view')) return <AccessDenied />;

  const sp = await searchParams;
  const tab = param(sp, 'status') ?? 'all';
  const paymentStatus = oneOf<PaymentStatus>(PAYMENT_STATUSES, param(sp, 'paymentStatus'));
  const paymentMethod = oneOf<PaymentMethod>(PAYMENT_METHODS, param(sp, 'paymentMethod'));
  const q = param(sp, 'q');
  const page = Math.max(1, Number(param(sp, 'page') ?? '1') || 1);

  const result = await getAdminOrders({ status: statusesFor(tab), paymentStatus, paymentMethod, q, page });
  const filters: OrdersListFilters = { status: tab, paymentStatus, paymentMethod, q };

  return <OrdersListView orders={result.data} meta={result.meta} counts={result.statusCounts} filters={filters} />;
}
