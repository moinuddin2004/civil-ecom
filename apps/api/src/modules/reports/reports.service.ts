import {
  hasAnyPermission,
  hasPermission,
  karachiDayEnd,
  karachiDayStart,
  type CodReportDTO,
  type DashboardDTO,
  type OrderStatus,
  type PermissionSubject,
  type SalesReportDTO,
  type TopProductsReportDTO,
} from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { toAdminOrderListItem } from '../orders/admin/admin-order.mappers.js';
import { addDays, fillSeries, periodKeys, todayKey } from './periods.js';
import { ReportsRepository, type ProductSalesRow } from './reports.repository.js';

/** Default report window when no dates are given: the last 30 days, today included. */
const DEFAULT_DAYS = 30;
const DASHBOARD_LIST_LIMIT = 10;
/** Longest report window; a day-by-day series beyond that is unreadable anyway. */
const MAX_RANGE_DAYS = 731;

export interface ReportRange {
  from?: string;
  to?: string;
}

/** Resolves the requested Karachi dates (inclusive) into keys and UTC bounds. */
export function resolveRange(range: ReportRange, now: Date = new Date()): { fromKey: string; toKey: string; from: Date; to: Date } {
  const toKey = range.to ?? todayKey(now);
  const fromKey = range.from ?? addDays(toKey, -(DEFAULT_DAYS - 1));
  if (fromKey > toKey) {
    throw AppError.validation('The start date must be on or before the end date.', [{ path: 'from', message: 'Pick a start date on or before the end date.' }]);
  }
  if (addDays(fromKey, MAX_RANGE_DAYS) < toKey) {
    throw AppError.validation('Pick a range of at most two years.', [{ path: 'from', message: 'Pick a range of at most two years.' }]);
  }
  return { fromKey, toKey, from: karachiDayStart(fromKey), to: karachiDayEnd(toKey) };
}

const toProductRow = (row: ProductSalesRow) => ({
  productId: String(row.productId),
  productName: row.productName,
  sku: row.sku,
  qty: row.qty,
  revenue: row.revenue,
});

/**
 * The dashboard (SPEC §10.3: only the widgets the viewer may see) and the reports (SPEC §10.11).
 * Sales exclude cancelled and returned orders; days are Karachi days.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly reports: ReportsRepository) {}

  async dashboard(viewer: PermissionSubject, now: Date = new Date()): Promise<DashboardDTO> {
    const can = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(viewer, permission);
    const dashboard: DashboardDTO = {};
    const today = todayKey(now);
    const tomorrowStart = karachiDayEnd(today);

    const tasks: Promise<void>[] = [];
    if (can('dashboard.view')) {
      tasks.push(
        (async () => {
          const since = (days: number) => karachiDayStart(addDays(today, -(days - 1)));
          const [todayTotals, week, month, points] = await Promise.all([
            this.reports.salesTotals(since(1), tomorrowStart),
            this.reports.salesTotals(since(7), tomorrowStart),
            this.reports.salesTotals(since(30), tomorrowStart),
            this.reports.salesSeries(since(30), tomorrowStart, 'day'),
          ]);
          const series = fillSeries(periodKeys(addDays(today, -29), today, 'day'), points, (period) => ({ period, orders: 0, revenue: 0 }));
          dashboard.sales = {
            today: todayTotals,
            last7Days: week,
            last30Days: month,
            series: series.map(({ period, orders, revenue }) => ({ date: period, orders, revenue })),
          };
        })(),
      );
    }
    if (can('orders.view')) {
      tasks.push(
        (async () => {
          const counts = await this.reports.ordersByStatus();
          const count = (status: OrderStatus) => counts.get(status) ?? 0;
          dashboard.ordersByStatus = {
            NEW: count('NEW'),
            CONFIRMED: count('CONFIRMED'),
            DISPATCHED: count('DISPATCHED'),
            DELIVERED: count('DELIVERED'),
            CANCELLED: count('CANCELLED'),
            RETURNED: count('RETURNED'),
          };
        })(),
      );
    }
    if (can('orders.verify_payment')) {
      tasks.push(
        (async () => {
          const waiting = await this.reports.awaitingVerification(DASHBOARD_LIST_LIMIT);
          dashboard.receiptsToVerify = { count: waiting.count, orders: waiting.orders.map(toAdminOrderListItem) };
        })(),
      );
    }
    if (hasAnyPermission(viewer, ['orders.cod_collect', 'dashboard.view'])) {
      tasks.push(
        (async () => {
          dashboard.codToCollect = await this.reports.codToCollect();
        })(),
      );
    }
    if (can('products.view')) {
      tasks.push(
        (async () => {
          const low = await this.reports.lowStock(DASHBOARD_LIST_LIMIT);
          dashboard.lowStock = {
            count: low.count,
            items: low.items.map((item) => ({
              productId: String(item.productId),
              productName: item.productName,
              variantId: String(item.variantId),
              sku: item.sku,
              variantLabel: item.variantLabel,
              stock: item.stock,
              threshold: item.threshold,
            })),
          };
        })(),
      );
    }
    await Promise.all(tasks);
    return dashboard;
  }

  async sales(range: ReportRange, groupBy: 'day' | 'month'): Promise<SalesReportDTO> {
    const { fromKey, toKey, from, to } = resolveRange(range);
    const [totals, points, payments] = await Promise.all([
      this.reports.financeTotals(from, to),
      this.reports.financeSeries(from, to, groupBy),
      this.reports.paymentBreakdown(from, to),
    ]);
    return {
      from: fromKey,
      to: toKey,
      groupBy,
      totals: {
        orders: totals.orders,
        revenue: totals.revenue,
        // Whole rupees, like every amount in the app.
        averageOrder: totals.orders > 0 ? Math.round(totals.revenue / totals.orders) : 0,
        subtotal: totals.subtotal,
        discounts: totals.discounts,
        deliveryFees: totals.deliveryFees,
        collected: totals.collected,
        pending: totals.pending,
      },
      series: fillSeries(periodKeys(fromKey, toKey, groupBy), points, (period) => ({ period, orders: 0, revenue: 0, collected: 0 })),
      byPayment: payments.map((row) => ({
        method: row.method as SalesReportDTO['byPayment'][number]['method'],
        orders: row.orders,
        revenue: row.revenue,
        collected: row.collected,
        pending: row.pending,
      })),
    };
  }

  async topProducts(range: ReportRange, limit: number): Promise<TopProductsReportDTO> {
    const { fromKey, toKey, from, to } = resolveRange(range);
    const top = await this.reports.topProducts(from, to, limit);
    return { from: fromKey, to: toKey, byQuantity: top.byQuantity.map(toProductRow), byRevenue: top.byRevenue.map(toProductRow) };
  }

  /** COD collected vs still to collect, by rider and by day (SPEC §7.3). */
  async cod(range: ReportRange): Promise<CodReportDTO> {
    const { fromKey, toKey, from, to } = resolveRange(range);
    const rows = await this.reports.codOrders(from, to);

    const totals = { collected: 0, pending: 0, collectedOrders: 0, pendingOrders: 0, expected: 0, short: 0, extra: 0 };
    const riders = new Map<string, CodReportDTO['byRider'][number]>();
    const days = new Map<string, { collected: number; pending: number; expected: number; short: number; extra: number }>();
    const differences: CodReportDTO['differences'] = [];
    for (const row of rows) {
      // Only orders whose cash is recorded have an "expected" and a difference.
      const expected = row.isCollected ? row.total : 0;
      const difference = row.isCollected ? row.collected - row.total : 0;
      const short = difference < 0 ? -difference : 0;
      const extra = difference > 0 ? difference : 0;
      totals.collected += row.collected;
      totals.pending += row.pending;
      totals.expected += expected;
      totals.short += short;
      totals.extra += extra;
      if (row.isCollected) totals.collectedOrders += 1;
      else totals.pendingOrders += 1;
      if (difference !== 0) {
        differences.push({
          orderId: String(row.orderId),
          orderNumber: row.orderNumber,
          riderName: row.riderName,
          date: row.date,
          total: row.total,
          collected: row.collected,
          difference,
          note: row.note,
        });
      }

      const riderKey = row.riderId ? String(row.riderId) : 'none';
      const rider = riders.get(riderKey) ?? {
        riderId: row.riderId ? String(row.riderId) : null,
        riderName: row.riderName ?? 'No rider yet',
        collected: 0,
        pending: 0,
        expected: 0,
        short: 0,
        extra: 0,
      };
      rider.collected += row.collected;
      rider.pending += row.pending;
      rider.expected += expected;
      rider.short += short;
      rider.extra += extra;
      riders.set(riderKey, rider);

      const day = days.get(row.date) ?? { collected: 0, pending: 0, expected: 0, short: 0, extra: 0 };
      day.collected += row.collected;
      day.pending += row.pending;
      day.expected += expected;
      day.short += short;
      day.extra += extra;
      days.set(row.date, day);
    }

    return {
      from: fromKey,
      to: toKey,
      totals,
      byRider: [...riders.values()].sort((a, b) => b.collected + b.pending - (a.collected + a.pending)),
      byDay: periodKeys(fromKey, toKey, 'day').map((date) => ({
        date,
        collected: days.get(date)?.collected ?? 0,
        pending: days.get(date)?.pending ?? 0,
        expected: days.get(date)?.expected ?? 0,
        short: days.get(date)?.short ?? 0,
        extra: days.get(date)?.extra ?? 0,
      })),
      differences: differences.sort((a, b) => a.difference - b.difference).slice(0, 100),
    };
  }
}
