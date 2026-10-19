'use client';

import {
  formatDate,
  formatDateTime,
  formatPKR,
  PAYMENT_METHOD_LABELS,
  type AdminCustomerDetailDTO,
  type ApiResponse,
} from '@aricon/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { OrderStatusBadge, PaymentStatusBadge, Pill } from '@/components/shop/status-badges';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/api-errors';
import { ConfirmDialog } from './confirm-dialog';

export interface CustomerDetailViewProps {
  customer: AdminCustomerDetailDTO;
  canBlock: boolean;
  canViewOrders: boolean;
}

/**
 * Customer detail (SPEC §10.8): profile, addresses, recent orders, and Block/Unblock
 * (`customers.block`) with confirmation; blocking signs the customer out everywhere.
 */
export function CustomerDetailView({ customer, canBlock, canViewOrders }: CustomerDetailViewProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (saving) return;
    const blocking = customer.status === 'active';
    setSaving(true);
    try {
      await apiClient<ApiResponse<AdminCustomerDetailDTO>>(`/admin/customers/${customer.id}/${blocking ? 'block' : 'unblock'}`, {
        method: 'POST',
        body: {},
      });
      toast.success(blocking ? `${customer.name} blocked` : `${customer.name} unblocked`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-h1">{customer.name}</h1>
          <Pill tone={customer.status === 'active' ? 'success' : 'danger'}>
            {customer.status === 'active' ? 'Active' : 'Blocked'}
          </Pill>
        </div>
        <Button
          type="button"
          variant={customer.status === 'active' ? 'destructive-outline' : 'primary'}
          size="sm"
          disabled={!canBlock}
          loading={saving}
          title={canBlock ? undefined : "You don't have permission to block customers."}
          onClick={() => setConfirmOpen(true)}
        >
          {customer.status === 'active' ? 'Block customer' : 'Unblock customer'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-concrete-150 bg-surface p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-ink">Profile</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-cement">Email</dt>
              <dd className="text-ink-700">{customer.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-cement">Phone</dt>
              <dd className="text-ink-700">{customer.phone || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-cement">Company</dt>
              <dd className="text-ink-700">{customer.companyName ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-cement">Orders</dt>
              <dd className="text-ink-700 tabular-nums">{customer.orderCount}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-cement">Total spent</dt>
              <dd className="text-ink-700 tabular-nums">{formatPKR(customer.totalSpent)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-cement">Joined</dt>
              <dd className="text-ink-700">{formatDate(customer.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-cement">Last login</dt>
              <dd className="text-ink-700">{customer.lastLoginAt ? formatDateTime(customer.lastLoginAt) : 'Never'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-concrete-150 bg-surface p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-ink">Addresses</h2>
          <div className="flex flex-col gap-3">
            {customer.addresses.map((address) => (
              <div key={address.id} className="rounded-md border border-concrete-150 p-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium text-ink">{address.label}</span>
                  {address.isDefault ? <Pill tone="info" size="sm">Default</Pill> : null}
                </div>
                <p className="text-ink-700">
                  {address.contactName} · {address.phone}
                </p>
                <p className="text-ink-700">
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ''}
                </p>
                {address.landmark ? <p className="text-cement">Landmark: {address.landmark}</p> : null}
                <p className="text-ink-700">
                  {address.areaName ?? 'Unknown area'}, {address.city}
                </p>
              </div>
            ))}
            {customer.addresses.length === 0 ? <p className="text-sm text-cement">No saved addresses.</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-concrete-150 bg-surface p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-ink">Recent orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-concrete-150 text-left text-xs text-cement">
                <th className="py-2 pr-3 font-medium">Order</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Total</th>
                <th className="py-2 pr-3 font-medium">Payment</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {customer.recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-concrete-150 last:border-b-0">
                  <td className="py-2 pr-3 font-medium">
                    {canViewOrders ? (
                      <Link href={`/admin/orders/${order.id}`} className="text-ink hover:text-blueprint">
                        {order.orderNumber}
                      </Link>
                    ) : (
                      <span className="text-ink">{order.orderNumber}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-ink-700">{formatDateTime(order.createdAt)}</td>
                  <td className="py-2 pr-3 tabular-nums text-ink-700">{formatPKR(order.total)}</td>
                  <td className="py-2 pr-3 text-ink-700">
                    {PAYMENT_METHOD_LABELS[order.paymentMethod]} <PaymentStatusBadge status={order.paymentStatus} size="sm" />
                  </td>
                  <td className="py-2">
                    <OrderStatusBadge status={order.status} size="sm" />
                  </td>
                </tr>
              ))}
              {customer.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-cement">
                    No orders yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${customer.status === 'active' ? 'Block' : 'Unblock'} ${customer.name}?`}
        description={
          customer.status === 'active'
            ? "They won't be able to sign in or place orders until unblocked."
            : 'They will be able to sign in and place orders again.'
        }
        confirmLabel={customer.status === 'active' ? 'Block' : 'Unblock'}
        confirmVariant={customer.status === 'active' ? 'destructive' : 'primary'}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
}
