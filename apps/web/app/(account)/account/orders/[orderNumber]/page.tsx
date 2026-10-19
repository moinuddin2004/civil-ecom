import { formatDateTime, formatPKR, formatQty, orderTimeline, PAYMENT_METHOD_LABELS } from '@aricon/shared';
import type { Metadata } from 'next';
import { OrderActionsBar } from '@/components/account/order-actions-bar';
import { OrderStatusTimeline } from '@/components/account/order-status-timeline';
import { ReceiptPanel } from '@/components/account/receipt-panel';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/shop/status-badges';
import { CARD_CLASS } from '@/components/shop/styles';
import { getCustomerOrder, getPublicSettings, orNotFound } from '@/lib/api-server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Order details' };

interface OrderDetailPageProps {
  params: Promise<{ orderNumber: string }>;
}

/**
 * Order detail (SPEC §9, §6.7, §6.8, DESIGN.md §6): status timeline, items, delivery address,
 * totals, payment panel (with receipt upload for bank transfer), rider block once dispatched,
 * cancel/reorder/invoice actions and WhatsApp support. Someone else's order is a 404 like an
 * unknown one.
 */
export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderNumber } = await params;
  const [order, settings] = await Promise.all([orNotFound(getCustomerOrder(orderNumber)), getPublicSettings()]);
  const steps = orderTimeline(order.status, order.statusHistory);
  const whatsappHref = `https://wa.me/${settings.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hi, my order ${order.orderNumber}`,
  )}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-h1">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
        <p className="text-sm text-cement">Placed {formatDateTime(order.createdAt)}</p>
        <OrderActionsBar order={order} />
      </div>

      <div className={cn(CARD_CLASS, 'p-5')}>
        <OrderStatusTimeline steps={steps} />
      </div>

      <div className={cn(CARD_CLASS, 'flex flex-col gap-1 p-5')}>
        <h2 className="type-h3">Items</h2>
        <div className="flex flex-col divide-y divide-concrete-200">
          {order.items.map((item) => (
            <div
              key={item.variantId}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-3 last:pb-0"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-ink">{item.productName}</span>
                <span className="text-sm text-cement">
                  {item.brandName} · {item.variantLabel} · SKU {item.sku}
                </span>
                <span className="text-sm text-ink-700">
                  {formatQty(item.qty, item.unit)} × {formatPKR(item.unitPrice)}
                  {item.appliedTierMinQty ? ` (bulk price, ${item.appliedTierMinQty}+)` : ''}
                </span>
              </div>
              <span className="type-price">{formatPKR(item.lineTotal)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cn(CARD_CLASS, 'flex flex-col gap-2 p-5')}>
          <h2 className="type-h3">Delivery address</h2>
          <p className="font-medium text-ink">{order.shippingAddress.label}</p>
          <p className="text-sm text-ink-700">
            {order.shippingAddress.contactName} · {order.shippingAddress.phone}
          </p>
          <p className="text-sm text-ink-700">
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
          </p>
          {order.shippingAddress.landmark ? (
            <p className="text-sm text-cement">Landmark: {order.shippingAddress.landmark}</p>
          ) : null}
          <p className="text-sm text-ink-700">
            {order.shippingAddress.areaName}, {order.shippingAddress.city}
          </p>

          {order.rider ? (
            <div className="mt-2 rounded-md bg-blueprint-50 p-3 text-sm text-ink">
              On the way with {order.rider.name}, {order.rider.phone}
            </div>
          ) : null}

          {order.customerNote ? <p className="mt-2 text-sm text-cement">Note: {order.customerNote}</p> : null}

          {order.cancelReason ? (
            <p className="mt-2 text-sm text-danger">Cancelled: {order.cancelReason}</p>
          ) : null}
        </div>

        <div className={cn(CARD_CLASS, 'flex flex-col gap-2 p-5')}>
          <h2 className="type-h3">Order total</h2>
          <div className="flex items-center justify-between text-sm text-ink-700">
            <span>Subtotal</span>
            <span>{formatPKR(order.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-ink-700">
            <span>Delivery</span>
            <span>{formatPKR(order.deliveryFee)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-concrete-200 pt-2 font-semibold text-ink">
            <span>Total</span>
            <span className="type-price">{formatPKR(order.total)}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-concrete-200 pt-3">
            <span className="text-sm font-medium text-ink">Payment</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-700">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
          </div>
          {order.paymentMethod === 'BANK_TRANSFER' ? (
            <ReceiptPanel orderNumber={order.orderNumber} receipts={order.receipts} canUploadReceipt={order.canUploadReceipt} />
          ) : (
            <p className="text-sm text-cement">
              {order.paymentStatus === 'PAID'
                ? 'Payment collected on delivery.'
                : order.status === 'CANCELLED' || order.status === 'RETURNED'
                  ? 'Nothing to pay for this order.'
                  : 'Pay the rider when your order arrives.'}
            </p>
          )}
        </div>
      </div>

      <div>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="link inline-flex items-center gap-1.5 text-sm font-medium"
        >
          Chat with support on WhatsApp
        </a>
      </div>
    </div>
  );
}
