import type { AdminOrderListItemDTO } from '@aricon/shared';
import type { OrderLean } from '../../../models/order.model.js';

/** The fields an admin order row needs. */
export type AdminOrderRow = Pick<
  OrderLean,
  '_id' | 'orderNumber' | 'createdAt' | 'user' | 'shippingAddress' | 'total' | 'paymentMethod' | 'paymentStatus' | 'status' | 'rider'
>;

/** Projection for `AdminOrderRow` queries. */
export const ADMIN_ORDER_ROW_FIELDS = {
  orderNumber: 1,
  createdAt: 1,
  user: 1,
  'shippingAddress.areaName': 1,
  total: 1,
  paymentMethod: 1,
  paymentStatus: 1,
  status: 1,
  rider: 1,
} as const;

export function toAdminOrderListItem(order: AdminOrderRow): AdminOrderListItemDTO {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    customerName: order.user.name,
    customerPhone: order.user.phone,
    areaName: order.shippingAddress.areaName,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    riderName: order.rider?.name ?? null,
  };
}
