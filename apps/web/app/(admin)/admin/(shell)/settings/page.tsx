import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { SettingsView } from '@/components/admin/settings-view';
import { getAdminSettings, isAdmin, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Settings' };

/** `/admin/settings` (SPEC §10.12, ADMIN only, SPEC §4.3). */
export default async function AdminSettingsPage() {
  const me = await requireStaff();
  if (!isAdmin(me)) return <AccessDenied />;
  return <SettingsView settings={await getAdminSettings()} />;
}
