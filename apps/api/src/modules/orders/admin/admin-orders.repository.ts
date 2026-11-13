import {
  escapeRegExp,
  karachiDayEnd,
  karachiDayStart,
  normalizePkPhone,
  ORDER_NUMBER_PATTERN,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types, type ClientSession, type Model, type UpdateQuery } from 'mongoose';
import { Paginated } from '../../../common/http/envelope.js';
import { Order, type OrderLean } from '../../../models/order.model.js';
import { User } from '../../../models/user.model.js';
import { ADMIN_ORDER_ROW_FIELDS, type AdminOrderRow } from './admin-order.mappers.js';

const { trusted } = mongoose;

export interface AdminOrderFilters {
  status?: OrderStatus[];
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  /** Karachi dates `YYYY-MM-DD`, both inclusive. */
  from?: string;
  to?: string;
  areaId?: string;
  riderId?: string;
  /** Order number, phone (any format) or customer name. */
  q?: string;
}

export interface AdminOrderSort {
  field: 'createdAt' | 'total' | 'orderNumber';
  direction: 'asc' | 'desc';
}

/** Order queries and conditional updates for the admin panel (SPEC §7.3 "Orders"). */
@Injectable()
export class AdminOrdersRepository {
  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async list(filters: AdminOrderFilters, page: number, pageSize: number, sort: AdminOrderSort): Promise<Paginated<AdminOrderRow>> {
    const filter = this.filter(filters);
    const direction = sort.direction === 'asc' ? 1 : -1;
    const [rows, total] = await Promise.all([
      this.orders
        .find(filter, ADMIN_ORDER_ROW_FIELDS)
        .sort({ [sort.field]: direction, _id: direction })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<AdminOrderRow[]>()
        .exec(),
      this.orders.countDocuments(filter).exec(),
    ]);
    return new Paginated(rows, { page, pageSize, total });
  }

  /** Every order matching the list filters, streamed in list order (Excel export, SPEC §7.3). */
  exportCursor(filters: AdminOrderFilters, sort: AdminOrderSort): AsyncIterable<OrderLean> {
    const direction = sort.direction === 'asc' ? 1 : -1;
    return this.orders
      .find(this.filter(filters))
      .sort({ [sort.field]: direction, _id: direction })
      .lean<OrderLean>()
      .cursor();
  }

  /** Orders per status for the list tabs: the same filters, except the status itself. */
  async statusCounts(filters: AdminOrderFilters): Promise<Record<OrderStatus | 'all', number>> {
    const rows = await this.orders
      .aggregate<{ _id: OrderStatus; count: number }>([
        { $match: this.filter({ ...filters, status: undefined }) },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();
    const counts: Record<OrderStatus | 'all', number> = {
      NEW: 0,
      CONFIRMED: 0,
      DISPATCHED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      RETURNED: 0,
      all: 0,
    };
    for (const row of rows) {
      counts[row._id] = row.count;
      counts.all += row.count;
    }
    return counts;
  }

  findById(id: string, session?: ClientSession): Promise<OrderLean | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.orders.findById(id, null, { session }).lean<OrderLean>().exec();
  }

  /**
   * Applies `update` only if the order still matches `expected` (e.g. its status hasn't moved since we
   * read it), so two staff acting on the same order can't both win. Null when it no longer matches.
   */
  updateIf(
    id: Types.ObjectId,
    expected: Record<string, unknown>,
    update: UpdateQuery<Order>,
    session: ClientSession,
  ): Promise<OrderLean | null> {
    return this.orders
      .findOneAndUpdate({ _id: id, ...expected }, update, { returnDocument: 'after', runValidators: true, session })
      .lean<OrderLean>()
      .exec();
  }

  /** Reviews one receipt, only while the order is still in `status` and that receipt still pending. */
  reviewPendingReceipt(
    orderId: Types.ObjectId,
    status: OrderStatus,
    receiptId: Types.ObjectId,
    set: Record<string, unknown>,
    session: ClientSession,
  ): Promise<OrderLean | null> {
    return this.orders
      .findOneAndUpdate(
        { _id: orderId, status, receipts: trusted({ $elemMatch: { _id: receiptId, status: 'pending' } }) },
        { $set: set },
        { returnDocument: 'after', runValidators: true, session },
      )
      .lean<OrderLean>()
      .exec();
  }

  /** Names of the staff/customers who acted on an order (status history, receipts, COD). */
  async userNames(ids: readonly (Types.ObjectId | undefined)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.flatMap((id) => (id ? [String(id)] : [])))];
    if (unique.length === 0) return new Map();
    const users = await this.users
      .find({ _id: trusted({ $in: unique.map((id) => new Types.ObjectId(id)) }) }, { name: 1 })
      .lean<{ _id: Types.ObjectId; name: string }[]>()
      .exec();
    return new Map(users.map((user) => [String(user._id), user.name]));
  }

  /** Every value comes from a validated DTO; `$in`/`$gte` are wrapped in `trusted()` for `sanitizeFilter`. */
  private filter(filters: AdminOrderFilters): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (filters.status && filters.status.length > 0) filter.status = trusted({ $in: filters.status });
    if (filters.paymentStatus) filter.paymentStatus = filters.paymentStatus;
    if (filters.paymentMethod) filter.paymentMethod = filters.paymentMethod;
    if (filters.areaId) filter.deliveryAreaId = new Types.ObjectId(filters.areaId);
    if (filters.riderId) filter.riderId = new Types.ObjectId(filters.riderId);
    if (filters.from || filters.to) {
      filter.createdAt = trusted({
        ...(filters.from && { $gte: karachiDayStart(filters.from) }),
        ...(filters.to && { $lt: karachiDayEnd(filters.to) }),
      });
    }
    const q = filters.q?.trim();
    if (q) {
      const phone = normalizePkPhone(q);
      if (ORDER_NUMBER_PATTERN.test(q.toUpperCase())) filter.orderNumber = q.toUpperCase();
      else if (/^\d{6}$/.test(q)) filter.trackingCode = q;
      else if (phone) filter['user.phone'] = phone;
      else filter.$or = [{ orderNumber: new RegExp(escapeRegExp(q), 'i') }, { 'user.name': new RegExp(escapeRegExp(q), 'i') }];
    }
    return filter;
  }
}
