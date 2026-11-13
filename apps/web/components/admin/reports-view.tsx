'use client';

import { formatDate, formatNumber, formatPKR, PAYMENT_METHOD_LABELS, type CodReportDTO, type SalesReportDTO, type TopProductsReportDTO } from '@aricon/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

type Tone = 'default' | 'good' | 'bad';

const TONE_CLASS: Record<Tone, string> = { default: 'text-ink', good: 'text-success', bad: 'text-danger' };

/** One headline number of a report card, with a short line under it saying what it means. */
function Stat({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: Tone }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-cement">{label}</p>
      <p className={`font-display text-xl font-bold tabular-nums ${TONE_CLASS[tone]}`}>{value}</p>
      {hint ? <p className="text-xs text-cement">{hint}</p> : null}
    </div>
  );
}

/** A "Short" / "Extra" amount cell: red for short, green for extra, a dash when there is none. */
function Difference({ short, extra }: { short: number; extra: number }) {
  if (short > 0) return <span className="font-medium text-danger">-{formatPKR(short)}</span>;
  if (extra > 0) return <span className="font-medium text-success">+{formatPKR(extra)}</span>;
  return <span className="text-cement">—</span>;
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

      <Card title="Sales and money received" action={exportButton('sales')}>
        <div className="mb-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Revenue" value={formatPKR(sales.totals.revenue)} hint={`${formatNumber(sales.totals.orders)} orders`} />
          <Stat label="Collected" value={formatPKR(sales.totals.collected)} hint="Money received" tone="good" />
          <Stat label="Still to collect" value={formatPKR(sales.totals.pending)} hint="Orders not paid yet" />
          <Stat label="Discounts given" value={formatPKR(sales.totals.discounts)} hint="Already taken off revenue" tone={sales.totals.discounts > 0 ? 'bad' : 'default'} />
          <Stat label="Delivery fees" value={formatPKR(sales.totals.deliveryFees)} hint="Included in revenue" />
          <Stat label="Average order" value={formatPKR(sales.totals.averageOrder)} />
        </div>

        <p className="mb-3 text-xs text-cement">
          Products {formatPKR(sales.totals.subtotal)} − discounts {formatPKR(sales.totals.discounts)} + delivery {formatPKR(sales.totals.deliveryFees)} = revenue{' '}
          {formatPKR(sales.totals.revenue)}. Cancelled and returned orders are left out.
        </p>

        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sales.series}>
              <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} />
              <YAxis hide />
              <Tooltip formatter={(value) => formatPKR(Number(value))} labelFormatter={(label) => String(label)} />
              <Legend verticalAlign="top" height={28} iconType="plainline" />
              <Line type="monotone" name="Revenue" dataKey="revenue" stroke="var(--color-amber)" strokeWidth={2} dot={false} />
              <Line type="monotone" name="Collected" dataKey="collected" stroke="var(--color-success)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-5 mb-2 text-sm font-medium text-ink">By payment method</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-concrete-150 text-left text-xs text-cement">
                <th className="py-2 pr-3 font-medium">Method</th>
                <th className="py-2 pr-3 font-medium">Orders</th>
                <th className="py-2 pr-3 font-medium">Revenue</th>
                <th className="py-2 pr-3 font-medium">Collected</th>
                <th className="py-2 font-medium">To collect</th>
              </tr>
            </thead>
            <tbody>
              {sales.byPayment.map((row) => (
                <tr key={row.method} className="border-b border-concrete-150 last:border-b-0">
                  <td className="py-2 pr-3 text-ink">{PAYMENT_METHOD_LABELS[row.method]}</td>
                  <td className="py-2 pr-3 tabular-nums text-ink-700">{formatNumber(row.orders)}</td>
                  <td className="py-2 pr-3 tabular-nums text-ink">{formatPKR(row.revenue)}</td>
                  <td className="py-2 pr-3 tabular-nums text-success">{formatPKR(row.collected)}</td>
                  <td className="py-2 tabular-nums text-ink-700">{formatPKR(row.pending)}</td>
                </tr>
              ))}
              {sales.byPayment.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-cement">
                    No sales in this range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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

      <Card title="Cash on delivery: expected vs collected" action={exportButton('cod')}>
        <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Expected" value={formatPKR(cod.totals.expected)} hint={`${formatNumber(cod.totals.collectedOrders)} orders collected`} />
          <Stat label="Collected" value={formatPKR(cod.totals.collected)} tone="good" />
          <Stat label="Short" value={formatPKR(cod.totals.short)} hint="Collected below the bill" tone={cod.totals.short > 0 ? 'bad' : 'default'} />
          <Stat label="Extra" value={formatPKR(cod.totals.extra)} hint="Collected above the bill" tone={cod.totals.extra > 0 ? 'good' : 'default'} />
          <Stat label="Still to collect" value={formatPKR(cod.totals.pending)} hint={`${formatNumber(cod.totals.pendingOrders)} orders`} />
          <Stat label="Net difference" value={formatPKR(cod.totals.collected - cod.totals.expected)} hint="Collected − expected" tone={cod.totals.collected < cod.totals.expected ? 'bad' : 'default'} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">By rider</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-concrete-150 text-left text-xs text-cement">
                    <th className="py-2 pr-3 font-medium">Rider</th>
                    <th className="py-2 pr-3 font-medium">Expected</th>
                    <th className="py-2 pr-3 font-medium">Collected</th>
                    <th className="py-2 pr-3 font-medium">Short / extra</th>
                    <th className="py-2 font-medium">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {cod.byRider.map((row) => (
                    <tr key={row.riderId ?? 'unassigned'} className="border-b border-concrete-150 last:border-b-0">
                      <td className="py-2 pr-3 text-ink">{row.riderName}</td>
                      <td className="py-2 pr-3 tabular-nums text-ink-700">{formatPKR(row.expected)}</td>
                      <td className="py-2 pr-3 tabular-nums text-success">{formatPKR(row.collected)}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        <Difference short={row.short} extra={row.extra} />
                      </td>
                      <td className="py-2 tabular-nums text-ink-700">{formatPKR(row.pending)}</td>
                    </tr>
                  ))}
                  {cod.byRider.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-cement">
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
                    <th className="py-2 pr-3 font-medium">Expected</th>
                    <th className="py-2 pr-3 font-medium">Collected</th>
                    <th className="py-2 pr-3 font-medium">Short / extra</th>
                    <th className="py-2 font-medium">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {cod.byDay.map((row) => (
                    <tr key={row.date} className="border-b border-concrete-150 last:border-b-0">
                      <td className="py-2 pr-3 text-ink-700">{formatDate(row.date)}</td>
                      <td className="py-2 pr-3 tabular-nums text-ink-700">{formatPKR(row.expected)}</td>
                      <td className="py-2 pr-3 tabular-nums text-success">{formatPKR(row.collected)}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        <Difference short={row.short} extra={row.extra} />
                      </td>
                      <td className="py-2 tabular-nums text-ink-700">{formatPKR(row.pending)}</td>
                    </tr>
                  ))}
                  {cod.byDay.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-cement">
                        No COD orders in this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="mt-5 mb-2 text-sm font-medium text-ink">Orders collected short or extra</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-concrete-150 text-left text-xs text-cement">
                <th className="py-2 pr-3 font-medium">Order</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Rider</th>
                <th className="py-2 pr-3 font-medium">Bill</th>
                <th className="py-2 pr-3 font-medium">Collected</th>
                <th className="py-2 pr-3 font-medium">Difference</th>
                <th className="py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {cod.differences.map((row) => (
                <tr key={row.orderId} className="border-b border-concrete-150 last:border-b-0">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/orders/${row.orderId}`} className="font-medium text-blueprint hover:text-blueprint-700">
                      {row.orderNumber}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-ink-700">{formatDate(row.date)}</td>
                  <td className="py-2 pr-3 text-ink-700">{row.riderName ?? '—'}</td>
                  <td className="py-2 pr-3 tabular-nums text-ink-700">{formatPKR(row.total)}</td>
                  <td className="py-2 pr-3 tabular-nums text-ink">{formatPKR(row.collected)}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    <Difference short={row.difference < 0 ? -row.difference : 0} extra={row.difference > 0 ? row.difference : 0} />
                  </td>
                  <td className="py-2 text-ink-700">{row.note ?? '—'}</td>
                </tr>
              ))}
              {cod.differences.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-cement">
                    Every collected order matched its bill.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
