import {
  canUploadReceipt,
  customerCanCancel,
  MAX_PENDING_RECEIPTS,
  type CustomerOrderDTO,
  type CustomerOrderListItemDTO,
  type OrderStateSnapshot,
  type PricedCartLine,
} from '@aricon/shared';
import { Types } from 'mongoose';
import type { OrderItem, OrderLean } from '../../models/order.model.js';
import type { OrderListRow } from './orders.repository.js';

/** Order line snapshot from a priced cart line (SPEC §5.10: copied once, never updated). */
export function toOrderItem(line: PricedCartLine): OrderItem {
  // Lines with issues never reach an order, so a missing product field here is a bug.
  if (line.sku === null || line.unit === null) throw new Error(`Cart line ${line.variantId} has no product data.`);
  return {
    productId: new Types.ObjectId(line.productId),
    variantId: new Types.ObjectId(line.variantId),
    sku: line.sku,
    productName: line.productName,
    variantLabel: line.variantLabel,
    brandName: line.brandName,
    unit: line.unit,
    imageKey: line.imageKey ?? undefined,
    qty: line.qty,
    mrp: line.mrp,
    basePrice: line.basePrice,
    unitPrice: line.unitPrice,
    appliedTierMinQty: line.appliedTierMinQty,
    lineTotal: line.lineTotal,
  };
}

/** The fields the shared status machine (`checkTransition`) looks at. */
export function toStateSnapshot(order: OrderLean): OrderStateSnapshot {
  return {
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    riderId: order.riderId ?? null,
    receipts: order.receipts.map((receipt) => ({ status: receipt.status })),
  };
}

/** The rider is shown to the customer once the order is on its way (shared `CustomerOrderDTO.rider`). */
const RIDER_VISIBLE = new Set(['DISPATCHED', 'DELIVERED']);

/** `GET /api/orders/:orderNumber`. Staff-only data (internal note, who reviewed, storage keys) stays out. */
export function toCustomerOrderDto(order: OrderLean, productSlugs: ReadonlyMap<string, string>): CustomerOrderDTO {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    items: order.items.map((item) => ({
      productId: String(item.productId),
      variantId: String(item.variantId),
      sku: item.sku,
      productName: item.productName,
      productSlug: productSlugs.get(String(item.productId)) ?? null,
      variantLabel: item.variantLabel,
      brandName: item.brandName,
      unit: item.unit,
      imageKey: item.imageKey ?? null,
      qty: item.qty,
      mrp: item.mrp,
      basePrice: item.basePrice,
      unitPrice: item.unitPrice,
      appliedTierMinQty: item.appliedTierMinQty ?? null,
      lineTotal: item.lineTotal,
    })),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    shippingAddress: {
      label: order.shippingAddress.label,
      contactName: order.shippingAddress.contactName,
      phone: order.shippingAddress.phone,
      line1: order.shippingAddress.line1,
      line2: order.shippingAddress.line2 ?? null,
      landmark: order.shippingAddress.landmark ?? null,
      areaId: String(order.shippingAddress.areaId),
      areaName: order.shippingAddress.areaName,
      city: order.shippingAddress.city,
    },
    receipts: order.receipts.map((receipt) => ({
      id: String(receipt._id),
      mimeType: receipt.mimeType,
      sizeBytes: receipt.sizeBytes,
      uploadedAt: receipt.uploadedAt.toISOString(),
      status: receipt.status,
      rejectReason: receipt.rejectReason ?? null,
      reviewedAt: receipt.reviewedAt?.toISOString() ?? null,
    })),
    statusHistory: order.statusHistory.map((entry) => ({
      status: entry.status,
      at: entry.at.toISOString(),
      byType: entry.byType,
      note: entry.note ?? null,
    })),
    rider: order.rider && RIDER_VISIBLE.has(order.status) ? { name: order.rider.name, phone: order.rider.phone } : null,
    customerNote: order.customerNote ?? null,
    cancelReason: order.cancelReason ?? null,
    canCancel: customerCanCancel(order),
    canUploadReceipt: canUploadReceipt(order, MAX_PENDING_RECEIPTS),
  };
}

export function toOrderListItem(row: OrderListRow): CustomerOrderListItemDTO {
  return {
    id: String(row._id),
    orderNumber: row.orderNumber,
    createdAt: row.createdAt.toISOString(),
    itemCount: row.items.reduce((sum, item) => sum + item.qty, 0),
    total: row.total,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    status: row.status,
  };
}
