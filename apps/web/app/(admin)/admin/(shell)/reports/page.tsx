import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { ReportsView } from '@/components/admin/reports-view';
import { can, getCodReport, getSalesReport, getTopProductsReport, requireStaff } from '@/lib/admin-data';
import { presetRange, REPORT_RANGE_PRESETS, type ReportRangePreset } from '@/lib/admin/report-dates';

export const metadata: Metadata = { title: 'Reports' };

interface ReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isPreset(value: string | undefined): value is ReportRangePreset {
  return Boolean(value) && (REPORT_RANGE_PRESETS as readonly string[]).includes(value as string);
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `/admin/reports` (SPEC §10.11, `reports.view`). The date range lives in `?preset=&from=&to=`
 * (SPEC §10.11 presets); the three reports for that range are loaded in parallel on every
 * navigation.
 */
export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  const me = await requireStaff();
  if (!can(me, 'reports.view')) return <AccessDenied />;

  const sp = await searchParams;
  const presetParam = firstParam(sp.preset);
  const preset: ReportRangePreset = isPreset(presetParam) ? presetParam : '7d';
  const fromParam = firstParam(sp.from);
  const toParam = firstParam(sp.to);

  const defaults = presetRange(preset);
  const custom = preset === 'custom' && fromParam && toParam && DATE_KEY.test(fromParam) && DATE_KEY.test(toParam);
  const [from, to] = custom ? [fromParam, toParam].sort() as [string, string] : [defaults.from, defaults.to];

  const [sales, topProducts, cod] = await Promise.all([
    getSalesReport(from, to, 'day'),
    getTopProductsReport(from, to),
    getCodReport(from, to),
  ]);

  return <ReportsView preset={preset} from={from} to={to} sales={sales} topProducts={topProducts} cod={cod} />;
}
