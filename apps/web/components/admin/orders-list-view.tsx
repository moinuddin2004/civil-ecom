'use client';

import {
  formatDateTime,
  formatNumber,
  formatPKR,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  type AdminOrderListItemDTO,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '@aricon/shared';
import Link from 'next/link';
import { AccessDenied } from '@/components/admin/access-denied';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/shop/status-badges';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/ui/download-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { buildAdminHref } from '@/lib/admin/query-string';
import { useAdminSession } from '@/lib/admin/session';
import { cn } from '@/lib/utils';

export interface OrdersListFilters {
  /** The active tab: an `OrderStatus`, `'cancelled_returned'` or `'all'`. */
  status: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  q?: string;
}

export interface OrdersListViewProps {
  orders: AdminOrderListItemDTO[];
  meta: { page: number; pageSize: number; total: number };
  counts: Record<OrderStatus | 'all', number>;
  filters: OrdersListFilters;
}

const BASE_PATH = '/admin/orders';

const TABS: { key: string; label: string }[] = [
  { key: 'NEW', label: 'New' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'DISPATCHED', label: 'On the way' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'cancelled_returned', label: 'Cancelled & returned' },
  { key: 'all', label: 'All' },
];

function tabCount(counts: OrdersListViewProps['counts'], key: string): number {
  if (key === 'cancelled_returned') return counts.CANCELLED + counts.RETURNED;
  return counts[key as OrderStatus | 'all'];
}

/**
 * Admin orders list (SPEC §10.4, DESIGN.md §9.3): status tabs, a filter bar and a dense table. The
 * page checks `orders.view` before loading anything; the check here only keeps the view safe on
 * its own.
 */
export function OrdersListView({ orders, meta, counts, filters }: OrdersListViewProps) {
  const { me } = useAdminSession();
  if (!me) return null;
  if (!me.permissions.includes('orders.view')) return <AccessDenied />;
  const canExport = me.permissions.includes('orders.export');

  const query = {
    status: filters.status === 'all' ? undefined : filters.status,
    paymentStatus: filters.paymentStatus,
    paymentMethod: filters.paymentMethod,
    q: filters.q,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h1">Orders</h1>
        {canExport ? (
          <DownloadButton
            path={buildAdminHref('/admin/orders/export', {
              status: filters.status === 'all' ? undefined : filters.status === 'cancelled_returned' ? 'CANCELLED,RETURNED' : filters.status,
              paymentStatus: filters.paymentStatus,
              paymentMethod: filters.paymentMethod,
              q: filters.q,
            })}
            fileName="orders.xlsx"
            variant="secondary"
            size="sm"
          >
            Export to Excel
          </DownloadButton>
        ) : null}
      </div>

      <nav aria-label="Order status" className="flex flex-wrap gap-1 border-b border-concrete-150">
        {TABS.map((tab) => {
          const active = filters.status === tab.key;
          return (
            <Link
              key={tab.key}
              href={buildAdminHref(BASE_PATH, { ...query, status: tab.key === 'all' ? undefined : tab.key, page: undefined })}
              aria-current={active || undefined}
              className={cn(
                'flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap',
                active ? 'border-ink text-ink' : 'border-transparent text-cement hover:text-ink-700',
              )}
            >
              {tab.label}
              <span className="tabular-nums">{formatNumber(tabCount(counts, tab.key))}</span>
            </Link>
          );
        })}
      </nav>

      <form method="get" action={BASE_PATH} className="flex flex-wrap items-end gap-3 rounded-xl border border-concrete-150 bg-surface p-3">
        {filters.status !== 'all' ? <input type="hidden" name="status" value={filters.status} /> : null}
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="orders-q" className="text-sm font-medium text-ink">
            Search
          </label>
          <Input id="orders-q" name="q" size="sm" placeholder="Order number or phone" defaultValue={filters.q ?? ''} />
        </div>
        <div className="flex min-w-40 flex-col gap-1.5">
          <label htmlFor="orders-payment-status" className="text-sm font-medium text-ink">
            Payment status
          </label>
          <Select
            id="orders-payment-status"
            name="paymentStatus"
            size="sm"
            placeholder="Any payment status"
            defaultValue={filters.paymentStatus ?? ''}
            options={PAYMENT_STATUSES.map((status) => ({ value: status, label: PAYMENT_STATUS_LABELS[status] }))}
          />
        </div>
        <div className="flex min-w-40 flex-col gap-1.5">
          <label htmlFor="orders-payment-method" className="text-sm font-medium text-ink">
            Payment method
          </label>
          <Select
            id="orders-payment-method"
            name="paymentMethod"
            size="sm"
            placeholder="Any payment method"
            defaultValue={filters.paymentMethod ?? ''}
            options={PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }))}
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Filter
        </Button>
        {filters.q || filters.paymentStatus || filters.paymentMethod ? (
          <Button type="button" variant="tertiary" size="sm" asChild>
            <Link href={buildAdminHref(BASE_PATH, { status: filters.status === 'all' ? undefined : filters.status })}>Clear</Link>
          </Button>
        ) : null}
      </form>

      <div className="overflow-x-auto rounded-xl border border-concrete-150 bg-surface">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-concrete-150 text-left text-xs text-cement">
              <th className="px-3 py-2.5 font-medium">Order</th>
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Customer</th>
              <th className="px-3 py-2.5 font-medium">Phone</th>
              <th className="px-3 py-2.5 font-medium">Area</th>
              <th className="px-3 py-2.5 font-medium">Total</th>
              <th className="px-3 py-2.5 font-medium">Payment</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Rider</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-concrete-150 last:border-b-0 hover:bg-concrete-50">
                <td className="px-3 py-2.5">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium text-blueprint hover:text-blueprint-700">
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-700">{formatDateTime(order.createdAt)}</td>
                <td className="px-3 py-2.5 text-ink">{order.customerName}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-700">{order.customerPhone}</td>
                <td className="px-3 py-2.5 text-ink-700">{order.areaName}</td>
                <td className="px-3 py-2.5 tabular-nums text-ink">{formatPKR(order.total)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-cement">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
                    <PaymentStatusBadge status={order.paymentStatus} size="sm" />
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <OrderStatusBadge status={order.status} size="sm" />
                </td>
                <td className="px-3 py-2.5 text-ink-700">{order.riderName ?? '—'}</td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-cement">
                  No orders match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminPagination basePath={BASE_PATH} query={query} meta={meta} />
    </div>
  );
}
