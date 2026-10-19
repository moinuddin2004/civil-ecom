import type { Metadata } from 'next';
import { AddressesClient } from '@/components/account/addresses-client';
import { getAddresses, getDeliveryAreas } from '@/lib/api-server';

export const metadata: Metadata = { title: 'Addresses' };

/** Saved delivery addresses (SPEC §9): list, add, edit, delete, set default. */
export default async function AddressesPage() {
  const [addresses, areas] = await Promise.all([getAddresses(), getDeliveryAreas()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-h1">Addresses</h1>
        <p className="text-cement">Manage where we deliver your orders.</p>
      </div>
      <AddressesClient initialAddresses={addresses} areas={areas} />
    </div>
  );
}
