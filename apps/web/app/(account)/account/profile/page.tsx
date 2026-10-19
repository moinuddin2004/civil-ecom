import type { Metadata } from 'next';
import { ProfileForms } from '@/components/account/profile-forms';
import { requireCustomer } from '@/lib/api-server';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Profile' };

/** Profile (SPEC §9): name/phone/company, read-only email, change password. */
export default async function ProfilePage() {
  const customer = await requireCustomer(routes.accountProfile);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-h1">Profile</h1>
        <p className="text-cement">Update your details and password.</p>
      </div>
      <ProfileForms customer={customer} />
    </div>
  );
}
