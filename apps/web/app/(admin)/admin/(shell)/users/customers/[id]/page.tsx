import type { Metadata } from "next";
import { BackButton } from "@/components/ui/back-button";
import { AccessDenied } from "@/components/admin/access-denied";
import { CustomerDetailView } from "@/components/admin/customer-detail-view";
import { can, getAdminCustomer, requireStaff } from "@/lib/admin-data";
import { orNotFound } from "@/lib/api-server";

export const metadata: Metadata = { title: "Customer" };

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Customer detail (SPEC §10.8, `customers.view`); an unknown id is a 404. */
export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const me = await requireStaff();
  if (!can(me, "customers.view")) return <AccessDenied />;

  const { id } = await params;
  const customer = await orNotFound(getAdminCustomer(id));
  return (
    <>
      <BackButton fallbackHref="/admin/users?tab=customers" className="mb-2" />
      <CustomerDetailView
        customer={customer}
        canBlock={can(me, "customers.block")}
        canDelete={can(me, "customers.delete")}
        canViewOrders={can(me, "orders.view")}
      />
    </>
  );
}
