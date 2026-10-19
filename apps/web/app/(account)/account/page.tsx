import { formatDateTime, formatPKR } from '@aricon/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderStatusBadge } from '@/components/shop/status-badges';
import { CARD_CLASS } from '@/components/shop/styles';
import { Button } from '@/components/ui/button';
import { getCustomerOrders, requireCustomer } from '@/lib/api-server';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'My account' };

/** Account overview (SPEC §9): greeting, last 3 orders, shortcuts to the rest of the section. */
export default async function AccountOverviewPage() {
  const [customer, { data: recentOrders }] = await Promise.all([requireCustomer(routes.account), getCustomerOrders(1, 3)]);
  const firstName = customer.name.split(' ')[0] ?? customer.name;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="type-h1">Hi, {firstName}</h1>
        <p className="text-cement">Welcome back to your account.</p>
      </div>

      <section aria-labelledby="recent-orders-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="recent-orders-heading" className="type-h2">
            Recent orders
          </h2>
          {recentOrders.length > 0 ? (
            <Link href={routes.accountOrders} className="link text-sm font-medium">
              View all
            </Link>
          ) : null}
        </div>

        {recentOrders.length === 0 ? (
          <div className={cn(CARD_CLASS, 'flex flex-col items-start gap-3 p-6')}>
            <p className="text-ink-700">You haven&apos;t placed an order yet.</p>
            <Button asChild size="md">
              <Link href={routes.home}>Browse products</Link>
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={routes.accountOrder(order.orderNumber)}
                  className={cn(
                    CARD_CLASS,
                    'flex flex-wrap items-center justify-between gap-3 p-4 transition-shadow hover:shadow-card-hover',
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-ink">{order.orderNumber}</span>
                    <span className="text-sm text-cement">{formatDateTime(order.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={order.status} />
                    <span className="type-price">{formatPKR(order.total)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="shortcuts-heading" className="flex flex-col gap-3">
        <h2 id="shortcuts-heading" className="type-h2">
          Manage your account
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href={routes.accountOrders}
            className={cn(CARD_CLASS, 'flex flex-col gap-1 p-4 transition-shadow hover:shadow-card-hover')}
          >
            <span className="font-semibold text-ink">Orders</span>
            <span className="text-sm text-cement">Track and manage your orders</span>
          </Link>
          <Link
            href={routes.accountAddresses}
            className={cn(CARD_CLASS, 'flex flex-col gap-1 p-4 transition-shadow hover:shadow-card-hover')}
          >
            <span className="font-semibold text-ink">Addresses</span>
            <span className="text-sm text-cement">Manage your delivery addresses</span>
          </Link>
          <Link
            href={routes.accountProfile}
            className={cn(CARD_CLASS, 'flex flex-col gap-1 p-4 transition-shadow hover:shadow-card-hover')}
          >
            <span className="font-semibold text-ink">Profile</span>
            <span className="text-sm text-cement">Update your details and password</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
