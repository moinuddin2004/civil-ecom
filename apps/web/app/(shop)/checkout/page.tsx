import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/shop/checkout-form';
import { getAddresses, getDeliveryAreas, getPublicSettings, requireCustomer } from '@/lib/api-server';
import { routes } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

/** Checkout needs an account (guest checkout is not offered, SPEC §1.3); the cart is merged at login. */
export default async function CheckoutPage() {
  await requireCustomer(routes.checkout);
  const [areas, settings, addresses] = await Promise.all([getDeliveryAreas(), getPublicSettings(), getAddresses()]);

  return (
    <div className="mx-auto max-w-content px-4 py-6 md:px-8 md:py-10">
      <h1 className="type-h1 mb-6">Checkout</h1>
      <CheckoutForm areas={areas} settings={settings} initialAddresses={addresses} />
    </div>
  );
}
