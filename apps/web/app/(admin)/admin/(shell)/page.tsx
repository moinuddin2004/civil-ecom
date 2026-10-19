import type { Metadata } from 'next';
import { DashboardView } from '@/components/admin/dashboard-view';
import { getDashboard } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Dashboard' };

/** Admin dashboard (SPEC §10.3): the API only includes the widgets the signed-in staff may see. */
export default async function AdminDashboardPage() {
  const dashboard = await getDashboard();
  return <DashboardView dashboard={dashboard} />;
}
