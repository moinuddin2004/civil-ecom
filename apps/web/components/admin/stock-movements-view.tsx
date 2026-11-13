'use client';

import {
  formatDateTime,
  formatNumber,
  STOCK_MOVEMENT_REASON_LABELS,
  STOCK_MOVEMENT_REASONS,
  type PageMeta,
  type StockMovementDTO,
  type StockMovementReason,
} from '@aricon/shared';
import Link from 'next/link';
import { AccessDenied } from '@/components/admin/access-denied';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { Button } from '@/components/ui/button';
import { AutoFilterForm } from '@/components/admin/auto-filter-form';
import { LiveSearchInput } from '@/components/admin/live-search-input';
import { Select } from '@/components/ui/select';
import { useAdminSession } from '@/lib/admin/session';
import { cn } from '@/lib/utils';

export interface StockMovementsFilters {
  sku?: string;
  reason?: StockMovementReason;
}

export interface StockMovementsViewProps {
  movements: StockMovementDTO[];
  meta: PageMeta;
  filters: StockMovementsFilters;
}

const BASE_PATH = '/admin/stock-movements';

/** Admin stock history (SPEC §10.6, DESIGN.md §9.6). Gated on `stock_movements.view`. */
export function StockMovementsView({ movements, meta, filters }: StockMovementsViewProps) {
  const { me } = useAdminSession();
  if (!me) return null;
  if (!me.permissions.includes('stock_movements.view')) return <AccessDenied />;

  const query = { sku: filters.sku, reason: filters.reason };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="type-h1">Stock history</h1>

      <AutoFilterForm action={BASE_PATH} className="flex flex-wrap items-end gap-3 rounded-xl border border-concrete-150 bg-surface p-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="stock-sku" className="text-sm font-medium text-ink">
            SKU
          </label>
          <LiveSearchInput id="stock-sku" name="sku" size="sm" placeholder="Search by SKU" defaultValue={filters.sku ?? ''} />
        </div>
        <div className="flex min-w-48 flex-col gap-1.5">
          <label htmlFor="stock-reason" className="text-sm font-medium text-ink">
            Reason
          </label>
          <Select
            id="stock-reason"
            name="reason"
            size="sm"
            placeholder="Any reason"
            defaultValue={filters.reason ?? ''}
            options={STOCK_MOVEMENT_REASONS.map((reason) => ({ value: reason, label: STOCK_MOVEMENT_REASON_LABELS[reason] }))}
          />
        </div>
        {filters.sku || filters.reason ? (
          <Button type="button" variant="tertiary" size="sm" asChild>
            <Link href={BASE_PATH}>Clear</Link>
          </Button>
        ) : null}
      </AutoFilterForm>

      <div className="overflow-x-auto rounded-xl border border-concrete-150 bg-surface">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-concrete-150 text-left text-xs text-cement">
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">SKU</th>
              <th className="px-3 py-2.5 font-medium">Product</th>
              <th className="px-3 py-2.5 font-medium">Change</th>
              <th className="px-3 py-2.5 font-medium">Stock after</th>
              <th className="px-3 py-2.5 font-medium">Reason</th>
              <th className="px-3 py-2.5 font-medium">Reference</th>
              <th className="px-3 py-2.5 font-medium">Note</th>
              <th className="px-3 py-2.5 font-medium">User</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id} className="border-b border-concrete-150 last:border-b-0 hover:bg-concrete-50">
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-700">{formatDateTime(movement.at)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-700">{movement.sku}</td>
                <td className="px-3 py-2.5 text-ink">{movement.productName ?? '—'}</td>
                <td className={cn('px-3 py-2.5 font-semibold tabular-nums', movement.change > 0 ? 'text-success' : movement.change < 0 ? 'text-danger' : 'text-ink-700')}>
                  {movement.change > 0 ? `+${formatNumber(movement.change)}` : formatNumber(movement.change)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-ink-700">{formatNumber(movement.stockAfter)}</td>
                <td className="px-3 py-2.5 text-ink-700">{STOCK_MOVEMENT_REASON_LABELS[movement.reason]}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {movement.refType === 'order' && movement.refId ? (
                    <Link href={`/admin/orders/${movement.refId}`} className="text-blueprint hover:text-blueprint-700">
                      {movement.refLabel}
                    </Link>
                  ) : movement.refType === 'import' ? (
                    <span className="text-ink-700">{movement.refLabel}</span>
                  ) : (
                    <span className="text-cement">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-ink-700">{movement.note ?? '—'}</td>
                <td className="px-3 py-2.5 text-ink-700">{movement.byUserName ?? 'System'}</td>
              </tr>
            ))}
            {movements.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-cement">
                  No stock movements match these filters.
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
