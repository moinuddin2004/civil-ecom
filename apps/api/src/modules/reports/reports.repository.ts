import { TIMEZONE, type OrderStatus } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, PipelineStage, Types } from 'mongoose';
import { Order } from '../../models/order.model.js';
import { Product } from '../../models/product.model.js';
import { ADMIN_ORDER_ROW_FIELDS, type AdminOrderRow } from '../orders/admin/admin-order.mappers.js';

/*
 * Read-only aggregations for the dashboard and reports (SPEC §10.3, §10.11). Pipelines are not
 * touched by `sanitizeFilter`; every value comes from code or a validated DTO (dates, numbers).
 */

/** Cancelled and returned orders are not sales (SPEC §7.3 reports). */
const NOT_SALES: OrderStatus[] = ['CANCELLED', 'RETURNED'];
const SALES = { status: { $nin: NOT_SALES } };

export interface SalesTotals {
  orders: number;
  revenue: number;
}

export interface SalesPoint extends SalesTotals {
  period: string;
}

/** Money received vs still to come, per order, as pipeline expressions (shared by every finance aggregation). */
const RECEIVED = { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, { $ifNull: ['$codCollected.amount', '$total'] }, 0] };
const OUTSTANDING = { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, 0, '$total'] };

export interface FinanceTotals extends SalesTotals {
  subtotal: number;
  discounts: number;
  deliveryFees: number;
  collected: number;
  pending: number;
}

export interface FinancePoint {
  period: string;
  orders: number;
  revenue: number;
  collected: number;
}

export interface PaymentRow {
  method: string;
  orders: number;
  revenue: number;
  collected: number;
  pending: number;
}

export interface LowStockItem {
  productId: Types.ObjectId;
  productName: string;
  variantId: Types.ObjectId;
  sku: string;
  variantLabel: string;
  stock: number;
  threshold: number;
}

export interface ProductSalesRow {
  productId: Types.ObjectId;
  productName: string;
  sku: string;
  qty: number;
  revenue: number;
}

export interface CodRow {
  orderId: Types.ObjectId;
  orderNumber: string;
  total: number;
  note: string | null;
  riderId: Types.ObjectId | null;
  riderName: string | null;
  date: string;
  collected: number;
  pending: number;
  isCollected: boolean;
}

const range = (from: Date, to: Date) => ({ createdAt: { $gte: from, $lt: to } });

/** Karachi calendar day (`YYYY-MM-DD`) or month (`YYYY-MM`) of `createdAt`. */
const periodOf = (unit: 'day' | 'month') => ({
  $dateToString: { format: unit === 'day' ? '%Y-%m-%d' : '%Y-%m', date: '$createdAt', timezone: TIMEZONE },
});

@Injectable()
export class ReportsRepository {
  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
  ) {}

  async salesTotals(from: Date, to: Date): Promise<SalesTotals> {
    const [row] = await this.orders
      .aggregate<SalesTotals>([
        { $match: { ...SALES, ...range(from, to) } },
        { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
        { $project: { _id: 0, orders: 1, revenue: 1 } },
      ])
      .exec();
    return row ?? { orders: 0, revenue: 0 };
  }

  /** The finance report's totals: revenue, discounts, delivery fees, money received and outstanding. */
  async financeTotals(from: Date, to: Date): Promise<FinanceTotals> {
    const [row] = await this.orders
      .aggregate<FinanceTotals>([
        { $match: { ...SALES, ...range(from, to) } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: { $sum: '$total' },
            subtotal: { $sum: '$subtotal' },
            discounts: { $sum: { $ifNull: ['$discountAmount', 0] } },
            deliveryFees: { $sum: '$deliveryFee' },
            collected: { $sum: RECEIVED },
            pending: { $sum: OUTSTANDING },
          },
        },
        { $project: { _id: 0 } },
      ])
      .exec();
    return row ?? { orders: 0, revenue: 0, subtotal: 0, discounts: 0, deliveryFees: 0, collected: 0, pending: 0 };
  }

  /** Revenue and money received per day/month that had sales (callers fill the gaps). */
  financeSeries(from: Date, to: Date, unit: 'day' | 'month'): Promise<FinancePoint[]> {
    return this.orders
      .aggregate<FinancePoint>([
        { $match: { ...SALES, ...range(from, to) } },
        { $group: { _id: periodOf(unit), orders: { $sum: 1 }, revenue: { $sum: '$total' }, collected: { $sum: RECEIVED } } },
        { $project: { _id: 0, period: '$_id', orders: 1, revenue: 1, collected: 1 } },
        { $sort: { period: 1 } },
      ])
      .exec();
  }

  paymentBreakdown(from: Date, to: Date): Promise<PaymentRow[]> {
    return this.orders
      .aggregate<PaymentRow>([
        { $match: { ...SALES, ...range(from, to) } },
        {
          $group: {
            _id: '$paymentMethod',
            orders: { $sum: 1 },
            revenue: { $sum: '$total' },
            collected: { $sum: RECEIVED },
            pending: { $sum: OUTSTANDING },
          },
        },
        { $project: { _id: 0, method: '$_id', orders: 1, revenue: 1, collected: 1, pending: 1 } },
        { $sort: { method: 1 } },
      ])
      .exec();
  }

  /** One point per day/month that had sales (callers fill the gaps). */
  salesSeries(from: Date, to: Date, unit: 'day' | 'month'): Promise<SalesPoint[]> {
    return this.orders
      .aggregate<SalesPoint>([
        { $match: { ...SALES, ...range(from, to) } },
        { $group: { _id: periodOf(unit), orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
        { $project: { _id: 0, period: '$_id', orders: 1, revenue: 1 } },
        { $sort: { period: 1 } },
      ])
      .exec();
  }

  async ordersByStatus(): Promise<Map<OrderStatus, number>> {
    const rows = await this.orders
      .aggregate<{ _id: OrderStatus; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }])
      .exec();
    return new Map(rows.map((row) => [row._id, row.count]));
  }

  /** Bank-transfer receipts waiting for staff, oldest first (they have waited longest). */
  async awaitingVerification(limit: number): Promise<{ count: number; orders: AdminOrderRow[] }> {
    const [row] = await this.orders
      .aggregate<{ orders: AdminOrderRow[]; total: { count: number }[] }>([
        { $match: { paymentStatus: 'AWAITING_VERIFICATION', status: { $nin: NOT_SALES } } },
        {
          $facet: {
            orders: [{ $sort: { createdAt: 1 } }, { $limit: limit }, { $project: ADMIN_ORDER_ROW_FIELDS }],
            total: [{ $count: 'count' }],
          },
        },
      ])
      .exec();
    return { count: row?.total[0]?.count ?? 0, orders: row?.orders ?? [] };
  }

  /** COD orders out with riders or delivered whose cash isn't recorded yet. */
  async codToCollect(): Promise<{ count: number; amount: number }> {
    const [row] = await this.orders
      .aggregate<{ count: number; amount: number }>([
        { $match: { paymentMethod: 'COD', status: { $in: ['DISPATCHED', 'DELIVERED'] }, paymentStatus: { $ne: 'PAID' } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$total' } } },
        { $project: { _id: 0, count: 1, amount: 1 } },
      ])
      .exec();
    return row ?? { count: 0, amount: 0 };
  }

  /** Active variants of non-archived products at or below their threshold (SPEC §6.10), lowest first. */
  async lowStock(limit: number): Promise<{ count: number; items: LowStockItem[] }> {
    const [row] = await this.products
      .aggregate<{ items: LowStockItem[]; total: { count: number }[] }>([
        { $match: { status: { $ne: 'archived' } } },
        { $unwind: '$variants' },
        { $match: { 'variants.isActive': true, $expr: { $lte: ['$variants.stock', '$variants.lowStockThreshold'] } } },
        {
          $facet: {
            items: [
              { $sort: { 'variants.stock': 1, name: 1 } },
              { $limit: limit },
              {
                $project: {
                  _id: 0,
                  productId: '$_id',
                  productName: '$name',
                  variantId: '$variants._id',
                  sku: '$variants.sku',
                  variantLabel: '$variants.label',
                  stock: '$variants.stock',
                  threshold: '$variants.lowStockThreshold',
                },
              },
            ],
            total: [{ $count: 'count' }],
          },
        },
      ])
      .exec();
    return { count: row?.total[0]?.count ?? 0, items: row?.items ?? [] };
  }

  /** Best sellers per variant, by quantity and by revenue, in one pass. */
  async topProducts(from: Date, to: Date, limit: number): Promise<{ byQuantity: ProductSalesRow[]; byRevenue: ProductSalesRow[] }> {
    const project: PipelineStage.Project = { $project: { _id: 0, productId: 1, productName: 1, sku: '$_id', qty: 1, revenue: 1 } };
    const [row] = await this.orders
      .aggregate<{ byQuantity: ProductSalesRow[]; byRevenue: ProductSalesRow[] }>([
        { $match: { ...SALES, ...range(from, to) } },
        { $sort: { createdAt: 1 } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.sku',
            productId: { $last: '$items.productId' },
            productName: { $last: '$items.productName' },
            qty: { $sum: '$items.qty' },
            revenue: { $sum: '$items.lineTotal' },
          },
        },
        {
          $facet: {
            byQuantity: [{ $sort: { qty: -1, revenue: -1 } }, { $limit: limit }, project],
            byRevenue: [{ $sort: { revenue: -1, qty: -1 } }, { $limit: limit }, project],
          },
        },
      ])
      .exec();
    return { byQuantity: row?.byQuantity ?? [], byRevenue: row?.byRevenue ?? [] };
  }

  /** COD orders in the period: cash recorded vs still to collect, per order (callers group them). */
  codOrders(from: Date, to: Date): Promise<CodRow[]> {
    return this.orders
      .aggregate<CodRow>([
        { $match: { ...SALES, ...range(from, to), paymentMethod: 'COD' } },
        {
          $project: {
            orderId: '$_id',
            _id: 0,
            orderNumber: 1,
            total: 1,
            note: { $ifNull: ['$codCollected.note', null] },
            riderId: { $ifNull: ['$riderId', null] },
            riderName: { $ifNull: ['$rider.name', null] },
            date: periodOf('day'),
            isCollected: { $eq: ['$paymentStatus', 'PAID'] },
            collected: { $ifNull: ['$codCollected.amount', 0] },
            pending: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, 0, '$total'] },
          },
        },
      ])
      .exec();
  }
}
