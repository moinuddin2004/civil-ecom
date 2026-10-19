import type { Metadata } from 'next';
import { OrderSuccessView } from '@/components/shop/order-success-view';
import { getCustomerOrder, getPublicSettings, orNotFound, requireCustomer } from '@/lib/api-server';
import { routes } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Order placed',
  robots: { index: false, follow: false },
};

interface OrderSuccessPageProps {
  params: Promise<{ orderNumber: string }>;
}

/** Only the customer who placed the order can see it (anyone else gets the not-found page). */
export default async function OrderSuccessPage({ params }: OrderSuccessPageProps) {
  const { orderNumber } = await params;
  await requireCustomer(routes.checkoutSuccess(orderNumber));
  const [order, settings] = await Promise.all([orNotFound(getCustomerOrder(orderNumber)), getPublicSettings()]);

  return (
    <OrderSuccessView
      order={order}
      whatsapp={settings.whatsapp}
      bankAccounts={settings.bankAccounts}
      bankTransferInstructions={settings.bankTransferInstructions}
    />
  );
}
