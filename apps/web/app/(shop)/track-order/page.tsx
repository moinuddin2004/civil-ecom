import type { Metadata } from 'next';
import Link from 'next/link';
import { TrackOrderForm } from '@/components/shop/track-order-form';
import { routes } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Track your order',
  description: 'Check the status of your Aricon Shop order with your 6-digit tracking code.',
  robots: { index: false, follow: true },
};

/** Public order tracking (SPEC §6.6b): no sign-in, the order's 6-digit tracking code. */
export default function TrackOrderPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10 md:py-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="type-h1">Track your order</h1>
        <p className="text-ink-700">Enter the 6-digit tracking code of your order to see where it is.</p>
      </div>
      <TrackOrderForm />
      <p className="text-sm text-cement">
        Have an account?{' '}
        <Link href={routes.accountOrders} className="font-medium text-blueprint underline-offset-2 hover:underline">
          See all your orders
        </Link>
      </p>
    </div>
  );
}
