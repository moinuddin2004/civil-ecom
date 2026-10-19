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
      ],
      [...report.series, { period: 'Total', orders: report.totals.orders, revenue: report.totals.revenue }],
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
        { header: 'Collected', money: true, value: (row) => row.collected },
        { header: 'To collect', money: true, value: (row) => row.pending },
      ],
      [...report.byRider, { riderId: null, riderName: 'Total', collected: report.totals.collected, pending: report.totals.pending }],
    ),
    sheet(
      'By day',
      [
        { header: 'Date', width: 14, value: (row: CodReportDTO['byDay'][number]) => row.date },
        { header: 'Collected', money: true, value: (row) => row.collected },
        { header: 'To collect', money: true, value: (row) => row.pending },
      ],
      report.byDay,
    ),
  ];
}
