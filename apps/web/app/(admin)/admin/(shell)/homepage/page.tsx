import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { HomepageView } from '@/components/admin/homepage-view';
import { can, getAdminHomepage, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Homepage' };

/** `/admin/homepage` (SPEC §10.10, `homepage.manage`). Products to feature are searched as you type. */
export default async function AdminHomepagePage() {
  const me = await requireStaff();
  if (!can(me, 'homepage.manage')) return <AccessDenied />;
  return <HomepageView homepage={await getAdminHomepage()} />;
}
