import { formatDateTime, formatNumber, formatPKR } from '@aricon/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/shop/status-badges';
import { CARD_CLASS } from '@/components/shop/styles';
import { getCustomerOrders } from '@/lib/api-server';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Your orders' };

const PAGE_SIZE = 20;

interface AccountOrdersPageProps {
  searchParams: Promise<{ page?: string }>;
}

/** Full order list (SPEC §9): number, date, item count, total, payment status, order status; paginated. */
export default async function AccountOrdersPage({ searchParams }: AccountOrdersPageProps) {
  const requested = Number.parseInt((await searchParams).page ?? '1', 10);
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
  const { data: orders, meta } = await getCustomerOrders(page, PAGE_SIZE);
  const first = (meta.page - 1) * meta.pageSize + 1;
  const last = first + orders.length - 1;
  const pageHref = (target: number) => (target > 1 ? `${routes.accountOrders}?page=${target}` : routes.accountOrders);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-h1">Your orders</h1>
        <p className="text-cement">Every order you have placed, newest first.</p>
      </div>

      {orders.length === 0 ? (
        <div className={cn(CARD_CLASS, 'p-6')}>
          <p className="text-ink-700">You haven&apos;t placed an order yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={routes.accountOrder(order.orderNumber)}
                className={cn(
                  CARD_CLASS,
                  'flex flex-col gap-3 p-4 transition-shadow hover:shadow-card-hover sm:flex-row sm:items-center sm:justify-between',
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-ink">{order.orderNumber}</span>
                  <span className="text-sm text-cement">
                    {formatDateTime(order.createdAt)} · {formatNumber(order.itemCount)} item
                    {order.itemCount === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PaymentStatusBadge status={order.paymentStatus} />
                  <OrderStatusBadge status={order.status} />
                  <span className="type-price ml-1">{formatPKR(order.total)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-concrete-200 pt-4 text-sm text-cement">
        <span>{orders.length === 0 ? `0 of ${formatNumber(meta.total)}` : `${first}–${last} of ${formatNumber(meta.total)}`}</span>
        <div className="flex gap-2">
          <PageLink href={meta.page > 1 ? pageHref(meta.page - 1) : null}>
            <ChevronLeft aria-hidden strokeWidth={1.75} className="size-4" />
            Previous
          </PageLink>
          <PageLink href={last < meta.total ? pageHref(meta.page + 1) : null}>
            Next
            <ChevronRight aria-hidden strokeWidth={1.75} className="size-4" />
          </PageLink>
        </div>
      </div>
    </div>
  );
}

const PAGE_LINK_CLASS = 'flex min-h-9 items-center gap-1 rounded-md border border-concrete-200 px-3 text-ink-700';

/** Previous/Next: a link when there is a page to go to, a disabled-looking label when there isn't. */
function PageLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className={cn(PAGE_LINK_CLASS, 'hover:border-concrete-400 hover:text-ink')}>
      {children}
    </Link>
  ) : (
    <span aria-disabled="true" className={cn(PAGE_LINK_CLASS, 'cursor-not-allowed text-concrete-400')}>
      {children}
    </span>
  );
}
