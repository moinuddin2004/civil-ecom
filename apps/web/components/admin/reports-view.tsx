'use client';

import { formatDate, formatNumber, formatPKR, type CodReportDTO, type SalesReportDTO, type TopProductsReportDTO } from '@aricon/shared';
import type { ReactNode } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { AccessDenied } from '@/components/admin/access-denied';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/ui/download-button';
import type { ReportRangePreset } from '@/lib/admin/report-dates';
import { useAdminSession } from '@/lib/admin/session';
import { ReportDateRange } from './report-date-range';

export interface ReportsViewProps {
  preset: ReportRangePreset;
  from: string;
  to: string;
  sales: SalesReportDTO;
  topProducts: TopProductsReportDTO;
  cod: CodReportDTO;
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-concrete-150 bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function ProductsTable({ rows, valueLabel, value }: { rows: TopProductsReportDTO['byQuantity']; valueLabel: string; value: (row: TopProductsReportDTO['byQuantity'][number]) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-concrete-150 text-left text-xs text-cement">
            <th className="py-2 pr-3 font-medium">Product</th>
            <th className="py-2 pr-3 font-medium">SKU</th>
            <th className="py-2 font-medium">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.productId} className="border-b border-concrete-150 last:border-b-0">
              <td className="py-2 pr-3 text-ink">{row.productName}</td>
              <td className="py-2 pr-3 text-ink-700">{row.sku}</td>
              <td className="py-2 font-semibold tabular-nums text-ink">{value(row)}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-3 text-cement">
                No sales in this range.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** `/admin/reports` (SPEC §10.11, `reports.view`); each report downloads as Excel with `reports.export`. */
export function ReportsView({ preset, from, to, sales, topProducts, cod }: ReportsViewProps) {
  const { me } = useAdminSession();
  if (!me || !me.permissions.includes('reports.view')) return <AccessDenied />;
  const canExport = me.permissions.includes('reports.export');

  const exportButton = (report: 'sales' | 'top-products' | 'cod') =>
    canExport ? (
      <DownloadButton path={`/admin/reports/${report}/export?from=${from}&to=${to}`} fileName={`${report}-${from}-to-${to}.xlsx`} variant="secondary" size="sm">
        Export to Excel
      </DownloadButton>
    ) : (
      <Button type="button" variant="secondary" size="sm" disabled title="You don't have permission to export reports.">
        Export to Excel
      </Button>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h1">Reports</h1>
        <p className="text-sm text-ink-700">
          {formatDate(from)} – {formatDate(to)}
        </p>
      </div>

      <ReportDateRange preset={preset} from={from} to={to} />

      <Card title="Sales" action={exportButton('sales')}>
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-cement">Orders</p>
            <p className="font-display text-2xl font-bold tabular-nums text-ink">{formatNumber(sales.totals.orders)}</p>
          </div>
          <div>
            <p className="text-xs text-cement">Revenue</p>
            <p className="font-display text-2xl font-bold tabular-nums text-ink">{formatPKR(sales.totals.revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-cement">Average order</p>
            <p className="font-display text-2xl font-bold tabular-nums text-ink">{formatPKR(sales.totals.averageOrder)}</p>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sales.series}>
              <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} />
              <Tooltip formatter={(value) => formatPKR(Number(value))} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-amber)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Top products by quantity" action={exportButton('top-products')}>
          <ProductsTable rows={topProducts.byQuantity} valueLabel="Qty" value={(row) => formatNumber(row.qty)} />
        </Card>
        <Card title="Top products by revenue">
          <ProductsTable rows={topProducts.byRevenue} valueLabel="Revenue" value={(row) => formatPKR(row.revenue)} />
        </Card>
      </div>

      <Card title="Cash on delivery" action={exportButton('cod')}>
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-cement">Collected</p>
            <p className="font-display text-xl font-bold tabular-nums text-success">{formatPKR(cod.totals.collected)}</p>
          </div>
          <div>
            <p className="text-xs text-cement">Pending</p>
            <p className="font-display text-xl font-bold tabular-nums text-ink">{formatPKR(cod.totals.pending)}</p>
          </div>
          <div>
            <p className="text-xs text-cement">Collected orders</p>
            <p className="font-display text-xl font-bold tabular-nums text-ink">{formatNumber(cod.totals.collectedOrders)}</p>
          </div>
          <div>
            <p className="text-xs text-cement">Pending orders</p>
            <p className="font-display text-xl font-bold tabular-nums text-ink">{formatNumber(cod.totals.pendingOrders)}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">By rider</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-concrete-150 text-left text-xs text-cement">
                    <th className="py-2 pr-3 font-medium">Rider</th>
                    <th className="py-2 pr-3 font-medium">Collected</th>
                    <th className="py-2 font-medium">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {cod.byRider.map((row) => (
                    <tr key={row.riderId ?? 'unassigned'} className="border-b border-concrete-150 last:border-b-0">
                      <td className="py-2 pr-3 text-ink">{row.riderName}</td>
                      <td className="py-2 pr-3 tabular-nums text-success">{formatPKR(row.collected)}</td>
                      <td className="py-2 tabular-nums text-ink-700">{formatPKR(row.pending)}</td>
                    </tr>
                  ))}
                  {cod.byRider.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3 text-cement">
                        No COD orders in this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink">By day</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-concrete-150 text-left text-xs text-cement">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Collected</th>
                    <th className="py-2 font-medium">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {cod.byDay.map((row) => (
                    <tr key={row.date} className="border-b border-concrete-150 last:border-b-0">
                      <td className="py-2 pr-3 text-ink-700">{formatDate(row.date)}</td>
                      <td className="py-2 pr-3 tabular-nums text-success">{formatPKR(row.collected)}</td>
                      <td className="py-2 tabular-nums text-ink-700">{formatPKR(row.pending)}</td>
                    </tr>
                  ))}
                  {cod.byDay.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3 text-cement">
                        No COD orders in this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
