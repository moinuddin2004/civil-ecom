import type { Metadata } from 'next';
import { CartView } from '@/components/shop/cart-view';
import { getDeliveryAreas } from '@/lib/api-server';

export const metadata: Metadata = {
  title: 'Your cart',
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const areas = await getDeliveryAreas();
  return <CartView areas={areas} />;
}
