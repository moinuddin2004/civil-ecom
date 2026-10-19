import { karachiDateTimeKey, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@aricon/shared';
import type { OrderLean } from '../../../models/order.model.js';
import { sheet, type SheetColumn, type SheetData } from '../../spreadsheets/xlsx.js';

const COLUMNS: SheetColumn<OrderLean>[] = [
  { header: 'Order number', width: 18, value: (order) => order.orderNumber },
  { header: 'Placed (Karachi)', width: 18, value: (order) => karachiDateTimeKey(order.createdAt) },
  { header: 'Customer', width: 24, value: (order) => order.user.name },
  { header: 'Phone', width: 16, value: (order) => order.user.phone },
  { header: 'Email', width: 28, value: (order) => order.user.email },
  { header: 'Area', width: 20, value: (order) => order.shippingAddress.areaName },
  { header: 'Items', width: 8, value: (order) => order.items.reduce((sum, item) => sum + item.qty, 0) },
  { header: 'Subtotal', money: true, value: (order) => order.subtotal },
  { header: 'Delivery', money: true, value: (order) => order.deliveryFee },
  { header: 'Total', money: true, value: (order) => order.total },
  { header: 'Payment method', value: (order) => PAYMENT_METHOD_LABELS[order.paymentMethod] },
  { header: 'Payment status', value: (order) => PAYMENT_STATUS_LABELS[order.paymentStatus] },
  { header: 'Status', value: (order) => ORDER_STATUS_LABELS[order.status] },
  { header: 'Rider', width: 20, value: (order) => order.rider?.name ?? '' },
  { header: 'Cash collected', money: true, value: (order) => order.codCollected?.amount ?? null },
];

/** `GET /api/admin/orders/export` (SPEC §7.3): the orders the list filters select. */
export function ordersExportSheet(orders: AsyncIterable<OrderLean>): SheetData {
  return sheet('Orders', COLUMNS, orders);
}
