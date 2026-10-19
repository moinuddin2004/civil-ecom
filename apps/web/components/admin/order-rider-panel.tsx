'use client';

import type { AdminOrderDTO, ApiResponse, OrderStatus, RiderDTO } from '@aricon/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useAdminSession } from '@/lib/admin/session';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/api-errors';

export interface OrderRiderPanelProps {
  order: AdminOrderDTO;
  riders: RiderDTO[];
}

/** Statuses in which the API lets staff set or change the rider. */
const RIDER_CHANGEABLE: readonly OrderStatus[] = ['NEW', 'CONFIRMED', 'DISPATCHED'];

/**
 * Rider assignment (SPEC §10.4), gated on `orders.assign_rider`: `POST /api/admin/orders/:id/rider`
 * with an active rider, then the page is refreshed with the updated order. The picker is hidden once
 * the order is delivered, cancelled or returned, since the rider can't change then.
 */
export function OrderRiderPanel({ order, riders }: OrderRiderPanelProps) {
  const { me } = useAdminSession();
  const router = useRouter();
  const [riderId, setRiderId] = useState(order.riderId ?? '');
  const [assigning, setAssigning] = useState(false);
  if (!me || !me.permissions.includes('orders.assign_rider')) return null;

  const changeable = RIDER_CHANGEABLE.includes(order.status);

  async function assign() {
    setAssigning(true);
    try {
      const { data } = await apiClient<ApiResponse<AdminOrderDTO>>(`/admin/orders/${order.id}/rider`, {
        method: 'POST',
        body: { riderId },
      });
      toast.success('Rider assigned', { description: data.rider ? data.rider.name : undefined });
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-concrete-150 bg-surface p-5">
      <h2 className="type-h3">Delivery</h2>
      {order.rider ? (
        <p className="text-sm text-ink-700">
          Currently {order.rider.name}, {order.rider.phone}
        </p>
      ) : (
        <p className="text-sm text-cement">No rider assigned.</p>
      )}
      {changeable ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-48 flex-col gap-1.5">
            <label htmlFor="order-rider" className="text-sm font-medium text-ink">
              Rider
            </label>
            <Select
              id="order-rider"
              size="sm"
              placeholder="Select rider"
              value={riderId}
              disabled={assigning}
              onChange={(event) => setRiderId(event.target.value)}
              options={riders.filter((r) => r.isActive).map((r) => ({ value: r.id, label: `${r.name} · ${r.phone}` }))}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!riderId || riderId === order.riderId}
            loading={assigning}
            onClick={() => void assign()}
          >
            Assign
          </Button>
        </div>
      ) : null}
    </div>
  );
}
