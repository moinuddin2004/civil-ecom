'use client';

import { formatDateTime, formatPKR, formatQty, formatShortDateTime, orderTimeline, type AdminOrderDTO, type RiderDTO } from '@aricon/shared';
import { OrderStatusTimeline } from '@/components/account/order-status-timeline';
import { AccessDenied } from '@/components/admin/access-denied';
import { OrderInternalNote } from '@/components/admin/order-internal-note';
import { OrderPaymentPanel } from '@/components/admin/order-payment-panel';
import { OrderRiderPanel } from '@/components/admin/order-rider-panel';
import { OrderStatusActions } from '@/components/admin/order-status-actions';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/shop/status-badges';
import { useAdminSession } from '@/lib/admin/session';

export interface OrderDetailViewProps {
  order: AdminOrderDTO;
  riders: RiderDTO[];
}

const ACTOR_LABEL: Record<'customer' | 'staff' | 'system', string> = {
  customer: 'Customer',
  staff: 'Staff',
  system: 'System',
};

/**
 * Admin order detail (SPEC §10.4, DESIGN.md §9.3). Gated on `orders.view`, same as the list.
 * The write actions (status transitions, receipt review, COD collected, rider assignment, internal
 * note) live in `OrderStatusActions`, `OrderPaymentPanel`, `OrderRiderPanel` and `OrderInternalNote`;
 * each calls the admin orders API, then refreshes the page so `order` comes back from the server.
 */
export function OrderDetailView({ order, riders }: OrderDetailViewProps) {
  const { me } = useAdminSession();
  if (!me) return null;
  if (!me.permissions.includes('orders.view')) return <AccessDenied />;

  const steps = orderTimeline(order.status, order.statusHistory);
  const whatsappHref = `https://wa.me/${order.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, about your order ${order.orderNumber}`)}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-h1">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
        <p className="text-sm text-cement">Placed {formatDateTime(order.createdAt)}</p>
        <OrderStatusActions order={order} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-concrete-150 bg-surface p-5">
          <h2 className="type-h3">Customer</h2>
          <p className="font-medium text-ink">{order.customer.name}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a href={`tel:${order.customer.phone.replace(/\s+/g, '')}`} className="text-blueprint hover:text-blueprint-700">
              {order.customer.phone}
            </a>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="text-blueprint hover:text-blueprint-700">
              WhatsApp
            </a>
          </div>
          {order.customer.email ? <p className="text-sm text-ink-700">{order.customer.email}</p> : null}
          <div className="mt-1 border-t border-concrete-150 pt-2 text-sm text-ink-700">
            <p>{order.shippingAddress.contactName}</p>
            <p>
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
            </p>
            {order.shippingAddress.landmark ? <p className="text-cement">Landmark: {order.shippingAddress.landmark}</p> : null}
            <p>
              {order.shippingAddress.areaName}, {order.shippingAddress.city}
            </p>
          </div>
          {order.customerNote ? <p className="mt-1 text-sm text-cement">Note: {order.customerNote}</p> : null}
          {order.cancelReason ? <p className="mt-1 text-sm text-danger">Cancelled: {order.cancelReason}</p> : null}
        </div>

        <OrderPaymentPanel order={order} />
      </div>

      {/* Keyed on the rider so the picker resets when the refreshed order has a different one. */}
      <OrderRiderPanel key={order.riderId ?? 'none'} order={order} riders={riders} />

      <div className="flex flex-col gap-1 rounded-xl border border-concrete-150 bg-surface p-5">
        <h2 className="type-h3">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-concrete-150 text-left text-xs text-cement">
                <th className="py-2 pr-3 font-medium">SKU</th>
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 pr-3 font-medium">Qty</th>
                <th className="py-2 pr-3 font-medium">Unit price</th>
                <th className="py-2 pr-3 font-medium">Tier</th>
                <th className="py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.variantId} className="border-b border-concrete-150 last:border-b-0">
                  <td className="py-2.5 pr-3 whitespace-nowrap text-ink-700">{item.sku}</td>
                  <td className="py-2.5 pr-3">
                    <span className="font-medium text-ink">{item.productName}</span>
                    <span className="block text-xs text-cement">{item.brandName} · {item.variantLabel}</span>
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums text-ink-700">{formatQty(item.qty, item.unit)}</td>
                  <td className="py-2.5 pr-3 tabular-nums text-ink-700">{formatPKR(item.unitPrice)}</td>
                  <td className="py-2.5 pr-3 text-ink-700">{item.appliedTierMinQty ? `${item.appliedTierMinQty}+` : '—'}</td>
                  <td className="py-2.5 font-medium tabular-nums text-ink">{formatPKR(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-end gap-1 border-t border-concrete-150 pt-3 text-sm">
          <div className="flex w-48 justify-between text-ink-700">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatPKR(order.subtotal)}</span>
          </div>
          <div className="flex w-48 justify-between text-ink-700">
            <span>Delivery</span>
            <span className="tabular-nums">{formatPKR(order.deliveryFee)}</span>
          </div>
          <div className="flex w-48 justify-between font-semibold text-ink">
            <span>Total</span>
            <span className="tabular-nums">{formatPKR(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-xl border border-concrete-150 bg-surface p-5">
          <h2 className="type-h3">Status timeline</h2>
          <OrderStatusTimeline steps={steps} />
          <ul className="flex flex-col gap-1.5 border-t border-concrete-150 pt-3 text-sm">
            {order.statusHistory.map((entry, index) => (
              <li key={`${entry.status}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-ink-700">
                  {ACTOR_LABEL[entry.byType]}
                  {entry.byUserName ? ` · ${entry.byUserName}` : ''}
                  {entry.note ? ` — ${entry.note}` : ''}
                </span>
                <span className="whitespace-nowrap text-xs text-cement">{formatShortDateTime(entry.at)}</span>
              </li>
            ))}
          </ul>
        </div>

        <OrderInternalNote order={order} />
      </div>
    </div>
  );
}
