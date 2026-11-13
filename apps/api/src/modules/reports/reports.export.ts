import type { CodReportDTO, SalesReportDTO, TopProductsReportDTO } from '@aricon/shared';
import { sheet, type SheetData } from '../spreadsheets/xlsx.js';

/* Report exports (SPEC §7.3 `GET /api/admin/reports/:report/export`): the same numbers as the
 * report on screen, one sheet per table, the date range in the file name. */

type TopRow = TopProductsReportDTO['byQuantity'][number];

export function salesSheets(report: SalesReportDTO): SheetData[] {
  return [
    sheet(
      'Sales',
      [
        { header: report.groupBy === 'month' ? 'Month' : 'Date', width: 14, value: (row: SalesReportDTO['series'][number]) => row.period },
        { header: 'Orders', width: 10, value: (row) => row.orders },
        { header: 'Revenue', money: true, value: (row) => row.revenue },
        { header: 'Collected', money: true, value: (row) => row.collected },
      ],
      [...report.series, { period: 'Total', orders: report.totals.orders, revenue: report.totals.revenue, collected: report.totals.collected }],
    ),
    sheet(
      'Summary',
      [
        { header: 'Item', width: 34, value: (row: { label: string; amount: number }) => row.label },
        { header: 'Amount', money: true, value: (row) => row.amount },
      ],
      [
        { label: 'Products total (before discounts and delivery)', amount: report.totals.subtotal },
        { label: 'Discounts given', amount: report.totals.discounts },
        { label: 'Delivery fees', amount: report.totals.deliveryFees },
        { label: 'Revenue', amount: report.totals.revenue },
        { label: 'Collected', amount: report.totals.collected },
        { label: 'Still to collect', amount: report.totals.pending },
      ],
    ),
    sheet(
      'By payment method',
      [
        { header: 'Method', width: 18, value: (row: SalesReportDTO['byPayment'][number]) => (row.method === 'COD' ? 'Cash on delivery' : 'Bank transfer') },
        { header: 'Orders', width: 10, value: (row) => row.orders },
        { header: 'Revenue', money: true, value: (row) => row.revenue },
        { header: 'Collected', money: true, value: (row) => row.collected },
        { header: 'To collect', money: true, value: (row) => row.pending },
      ],
      report.byPayment,
    ),
  ];
}

export function topProductsSheets(report: TopProductsReportDTO): SheetData[] {
  const columns = [
    { header: 'Product', width: 40, value: (row: TopRow) => row.productName },
    { header: 'SKU', width: 18, value: (row: TopRow) => row.sku },
    { header: 'Quantity', width: 10, value: (row: TopRow) => row.qty },
    { header: 'Revenue', money: true, value: (row: TopRow) => row.revenue },
  ];
  return [sheet('By quantity', columns, report.byQuantity), sheet('By revenue', columns, report.byRevenue)];
}

export function codSheets(report: CodReportDTO): SheetData[] {
  return [
    sheet(
      'By rider',
      [
        { header: 'Rider', width: 24, value: (row: CodReportDTO['byRider'][number]) => row.riderName },
        { header: 'Expected', money: true, value: (row) => row.expected },
        { header: 'Collected', money: true, value: (row) => row.collected },
        { header: 'Short', money: true, value: (row) => row.short },
        { header: 'Extra', money: true, value: (row) => row.extra },
        { header: 'To collect', money: true, value: (row) => row.pending },
      ],
      [
        ...report.byRider,
        {
          riderId: null,
          riderName: 'Total',
          collected: report.totals.collected,
          pending: report.totals.pending,
          expected: report.totals.expected,
          short: report.totals.short,
          extra: report.totals.extra,
        },
      ],
    ),
    sheet(
      'By day',
      [
        { header: 'Date', width: 14, value: (row: CodReportDTO['byDay'][number]) => row.date },
        { header: 'Expected', money: true, value: (row) => row.expected },
        { header: 'Collected', money: true, value: (row) => row.collected },
        { header: 'Short', money: true, value: (row) => row.short },
        { header: 'Extra', money: true, value: (row) => row.extra },
        { header: 'To collect', money: true, value: (row) => row.pending },
      ],
      report.byDay,
    ),
    sheet(
      'Short and extra',
      [
        { header: 'Order', width: 18, value: (row: CodReportDTO['differences'][number]) => row.orderNumber },
        { header: 'Date', width: 14, value: (row) => row.date },
        { header: 'Rider', width: 22, value: (row) => row.riderName ?? '' },
        { header: 'Order total', money: true, value: (row) => row.total },
        { header: 'Collected', money: true, value: (row) => row.collected },
        { header: 'Difference', money: true, value: (row) => row.difference },
        { header: 'Reason', width: 44, value: (row) => row.note ?? '' },
      ],
      report.differences,
    ),
  ];
}
