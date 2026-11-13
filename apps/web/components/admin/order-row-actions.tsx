'use client';

import { staffTransitionsFrom, type AdminOrderDTO, type AdminOrderListItemDTO, type ApiResponse, type OrderStatus, type RiderDTO } from '@aricon/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { TransitionButton, type TransitionOrder } from '@/components/admin/order-status-actions';
import { Select } from '@/components/ui/select';
import { useAdminSession } from '@/lib/admin/session';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/api-errors';

/** Statuses in which the API lets staff set or change the rider (same list as the detail page). */
const RIDER_CHANGEABLE: readonly OrderStatus[] = ['NEW', 'CONFIRMED', 'DISPATCHED'];

function toTransitionOrder(order: AdminOrderListItemDTO): TransitionOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    hasRider: order.riderId !== null,
  };
}

/**
 * The next-status buttons of one orders-list row: the same transitions, permission checks, reasons
 * and confirmations as the order page (`staffTransitionsFrom()` + `TransitionButton`), so staff
 * don't have to open each order. The API checks everything again.
 */
export function OrderRowStatusActions({ order }: { order: AdminOrderListItemDTO }) {
  const { me } = useAdminSession();
  if (!me) return null;

  const transitions = staffTransitionsFrom(order.status, { role: me.user.role, permissions: me.permissions });
  if (transitions.length === 0) return <span className="text-cement">—</span>;

  const transitionOrder = toTransitionOrder(order);
  return (
    <div className="flex items-center gap-1.5">
      {transitions.map((transition) => (
        <TransitionButton key={transition.to} order={transitionOrder} transition={transition} compact />
      ))}
    </div>
  );
}

/**
 * Rider picker of one orders-list row (`orders.assign_rider`): choosing a rider saves at once with
 * `POST /api/admin/orders/:id/rider`, then the list refreshes. Without the permission, or once the
 * order is delivered, cancelled or returned, it shows the rider's name as plain text.
 */
export function OrderRowRider({ order, riders }: { order: AdminOrderListItemDTO; riders: RiderDTO[] }) {
  const { me } = useAdminSession();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const canAssign = Boolean(me?.permissions.includes('orders.assign_rider')) && RIDER_CHANGEABLE.includes(order.status);
  if (!canAssign) return <span className="text-ink-700">{order.riderName ?? '—'}</span>;

  const options = riders.filter((rider) => rider.isActive).map((rider) => ({ value: rider.id, label: rider.name }));
  // A rider who was switched off since the assignment still has to show as the current choice.
  if (order.riderId && !options.some((option) => option.value === order.riderId)) {
    options.unshift({ value: order.riderId, label: order.riderName ?? 'Current rider' });
  }

  async function assign(riderId: string) {
    if (!riderId || riderId === order.riderId) return;
    setSaving(true);
    try {
      const { data } = await apiClient<ApiResponse<AdminOrderDTO>>(`/admin/orders/${order.id}/rider`, { method: 'POST', body: { riderId } });
      toast.success('Rider assigned', { description: `${order.orderNumber}: ${data.rider?.name ?? ''}` });
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-40">
      <label htmlFor={`rider-${order.id}`} className="sr-only">
        Rider for {order.orderNumber}
      </label>
      <Select
        id={`rider-${order.id}`}
        size="xs"
        placeholder="Assign rider"
        value={order.riderId ?? ''}
        disabled={saving}
        onValueChange={(value) => void assign(value)}
        options={options}
      />
    </div>
  );
}
