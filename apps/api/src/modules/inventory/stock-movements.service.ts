import { karachiDayEnd, karachiDayStart, type StockMovementDTO, type StockMovementReason } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types, type Model } from 'mongoose';
import { Paginated } from '../../common/http/envelope.js';
import { Order } from '../../models/order.model.js';
import { Product } from '../../models/product.model.js';
import { StockMovement, type StockMovementLean } from '../../models/stock-movement.model.js';
import { User } from '../../models/user.model.js';

const { trusted } = mongoose;

export interface StockMovementFilters {
  sku?: string;
  productId?: string;
  reason?: StockMovementReason;
  /** Karachi dates, inclusive. */
  from?: string;
  to?: string;
}

/** Names behind the ids in a page of movements, looked up in one query per collection. */
async function namesById<T>(model: Model<T>, ids: readonly Types.ObjectId[], field: keyof T & string): Promise<Map<string, string>> {
  const unique = [...new Set(ids.map(String))].map((id) => new Types.ObjectId(id));
  if (unique.length === 0) return new Map();
  const rows = await model
    .find({ _id: trusted({ $in: unique }) }, { [field]: 1 })
    .lean<Record<string, unknown>[]>()
    .exec();
  return new Map(rows.map((row) => [String(row._id), String(row[field])]));
}

/** Stock history for staff (SPEC §10.6, `stock_movements.view`): newest first, paginated. */
@Injectable()
export class StockMovementsService {
  constructor(
    @InjectModel(StockMovement.name) private readonly movements: Model<StockMovement>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async list(filters: StockMovementFilters, page: number, pageSize: number): Promise<Paginated<StockMovementDTO>> {
    const filter: Record<string, unknown> = {};
    if (filters.sku) filter.sku = filters.sku;
    if (filters.productId) filter.productId = new Types.ObjectId(filters.productId);
    if (filters.reason) filter.reason = filters.reason;
    if (filters.from || filters.to) {
      filter.at = trusted({
        ...(filters.from && { $gte: karachiDayStart(filters.from) }),
        ...(filters.to && { $lt: karachiDayEnd(filters.to) }),
      });
    }

    const [rows, total] = await Promise.all([
      this.movements
        .find(filter)
        .sort({ at: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<StockMovementLean[]>()
        .exec(),
      this.movements.countDocuments(filter).exec(),
    ]);

    const orderIds = rows.flatMap((row) => (row.refType === 'order' && row.refId ? [row.refId] : []));
    const [productNames, orderNumbers, userNames] = await Promise.all([
      namesById(this.products, rows.map((row) => row.productId), 'name'),
      namesById(this.orders, orderIds, 'orderNumber'),
      namesById(this.users, rows.flatMap((row) => (row.byUserId ? [row.byUserId] : [])), 'name'),
    ]);

    return new Paginated(
      rows.map((row) => ({
        id: String(row._id),
        at: row.at.toISOString(),
        productId: String(row.productId),
        productName: productNames.get(String(row.productId)) ?? null,
        variantId: String(row.variantId),
        sku: row.sku,
        change: row.change,
        stockAfter: row.stockAfter,
        reason: row.reason,
        refType: row.refType ?? null,
        refId: row.refId ? String(row.refId) : null,
        refLabel: row.refType === 'order' && row.refId ? (orderNumbers.get(String(row.refId)) ?? null) : null,
        note: row.note ?? null,
        byUserName: row.byUserId ? (userNames.get(String(row.byUserId)) ?? null) : null,
      })),
      { page, pageSize, total },
    );
  }
}
