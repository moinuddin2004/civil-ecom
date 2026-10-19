'use client';

import { formatNumber, formatPKR, ORDER_STATUS_LABELS, type DashboardDTO, type OrderStatus, type Permission } from '@aricon/shared';
import Link from 'next/link';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useAdminSession } from '@/lib/admin/session';

export interface DashboardViewProps {
  dashboard: DashboardDTO;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-concrete-150 bg-surface p-4 shadow-card">
      <p className="text-sm text-cement">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums text-ink">{value}</p>
      {sub ? <p className="text-xs text-cement">{sub}</p> : null}
    </div>
  );
}

/** Admin dashboard (SPEC §10.3, DESIGN.md §9.2). Only the sections the signed-in staff may see render. */
export function DashboardView({ dashboard }: DashboardViewProps) {
  const { me } = useAdminSession();
  if (!me) return null;
  const can = (perm: Permission) => me.permissions.includes(perm);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="type-h1">Dashboard</h1>

      {dashboard.sales && can('dashboard.view') ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Today's orders" value={formatNumber(dashboard.sales.today.orders)} />
            <StatCard label="Today's revenue" value={formatPKR(dashboard.sales.today.revenue)} />
            <StatCard label="Last 7 days revenue" value={formatPKR(dashboard.sales.last7Days.revenue)} sub={`${formatNumber(dashboard.sales.last7Days.orders)} orders`} />
            <StatCard label="Last 30 days revenue" value={formatPKR(dashboard.sales.last30Days.revenue)} sub={`${formatNumber(dashboard.sales.last30Days.orders)} orders`} />
          </div>

          <div className="rounded-xl border border-concrete-150 bg-surface p-4 shadow-card">
            <p className="mb-2 text-sm font-semibold text-ink">Revenue, last 30 days</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboard.sales.series}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} />
                  <Tooltip formatter={(value) => formatPKR(Number(value))} />
                  <Line type="monotone" dataKey="revenue" stroke="var(--color-amber)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {dashboard.ordersByStatus && can('orders.view') ? (
          <div className="rounded-xl border border-concrete-150 bg-surface p-4 shadow-card">
            <p className="mb-3 text-sm font-semibold text-ink">Orders by status</p>
            <ul className="flex flex-col divide-y divide-concrete-150">
              {(Object.entries(dashboard.ordersByStatus) as [OrderStatus, number][]).map(([status, count]) => (
                <li key={status}>
                  <Link href={`/admin/orders?status=${status}`} className="flex items-center justify-between py-2.5 text-sm hover:text-blueprint">
                    <span>{ORDER_STATUS_LABELS[status]}</span>
                    <span className="font-semibold tabular-nums">{formatNumber(count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {dashboard.receiptsToVerify && can('orders.verify_payment') ? (
          <div className="rounded-xl border border-concrete-150 bg-surface p-4 shadow-card">
            <p className="mb-3 text-sm font-semibold text-ink">Receipts to verify ({formatNumber(dashboard.receiptsToVerify.count)})</p>
            <ul className="flex flex-col divide-y divide-concrete-150">
              {dashboard.receiptsToVerify.orders.slice(0, 5).map((order) => (
                <li key={order.id}>
                  <Link href={`/admin/orders/${order.id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-blueprint">
                    <span>{order.orderNumber}</span>
                    <span className="tabular-nums text-ink-700">{formatPKR(order.total)}</span>
                  </Link>
                </li>
              ))}
              {dashboard.receiptsToVerify.count === 0 ? <li className="py-2.5 text-sm text-cement">Nothing to verify.</li> : null}
            </ul>
          </div>
        ) : null}

        {dashboard.codToCollect && (can('orders.cod_collect') || can('dashboard.view')) ? (
          <StatCard label="Cash to collect" value={formatPKR(dashboard.codToCollect.amount)} sub={`${formatNumber(dashboard.codToCollect.count)} orders`} />
        ) : null}

        {dashboard.lowStock && can('products.view') ? (
          <div className="rounded-xl border border-concrete-150 bg-surface p-4 shadow-card lg:col-span-2">
            <p className="mb-3 text-sm font-semibold text-ink">Low stock ({formatNumber(dashboard.lowStock.count)})</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-concrete-150 text-left text-xs text-cement">
                    <th className="py-2 pr-3 font-medium">Product</th>
                    <th className="py-2 pr-3 font-medium">Variant</th>
                    <th className="py-2 pr-3 font-medium">Stock</th>
                    <th className="py-2 font-medium">Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.lowStock.items.slice(0, 10).map((item) => (
                    <tr key={item.variantId} className="border-b border-concrete-150 last:border-b-0">
                      <td className="py-2 pr-3">{item.productName}</td>
                      <td className="py-2 pr-3 text-ink-700">{item.variantLabel}</td>
                      <td className="py-2 pr-3 font-semibold tabular-nums text-danger">{formatNumber(item.stock)}</td>
                      <td className="py-2 tabular-nums text-ink-700">{formatNumber(item.threshold)}</td>
                    </tr>
                  ))}
                  {dashboard.lowStock.count === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-cement">Nothing is low on stock.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
