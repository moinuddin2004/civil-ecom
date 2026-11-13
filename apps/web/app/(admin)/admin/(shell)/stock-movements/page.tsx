import { parsePageSize } from '@/lib/admin/page-size';
import { DEFAULT_PAGE_SIZE, STOCK_MOVEMENT_REASONS, type StockMovementReason } from '@aricon/shared';
import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { StockMovementsView } from '@/components/admin/stock-movements-view';
import { can, getStockMovements, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Stock history' };

interface StockMovementsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function param(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = sp[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
}

/** The API's SKU format; anything else can't match a movement, so it isn't sent. */
const SKU = /^[A-Z0-9][A-Z0-9._-]{1,39}$/;

/** Stock history (SPEC §10.6): every stock change, with a link back to the order that caused it. */
export default async function StockMovementsPage({ searchParams }: StockMovementsPageProps) {
  const me = await requireStaff();
  if (!can(me, 'stock_movements.view')) return <AccessDenied />;

  const sp = await searchParams;
  const sku = param(sp, 'sku')?.toUpperCase();
  const reasonParam = param(sp, 'reason');
  const reason = STOCK_MOVEMENT_REASONS.includes(reasonParam as StockMovementReason) ? (reasonParam as StockMovementReason) : undefined;
  const page = Math.max(1, Number(param(sp, 'page') ?? '1') || 1);
  const pageSize = parsePageSize(param(sp, 'pageSize'));

  const { data, meta } =
    sku && !SKU.test(sku)
      ? { data: [], meta: { page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 } }
      : await getStockMovements({ sku, reason, page, pageSize });
  return <StockMovementsView movements={data} meta={meta} filters={{ sku, reason }} />;
}
