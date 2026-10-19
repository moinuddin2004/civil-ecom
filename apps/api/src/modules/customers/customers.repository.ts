import { escapeRegExp, normalizePkPhone, type UserStatus } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model, type PipelineStage } from 'mongoose';
import { Paginated } from '../../common/http/envelope.js';
import { Order } from '../../models/order.model.js';
import { User, type UserLean } from '../../models/user.model.js';
import { ADMIN_ORDER_ROW_FIELDS, type AdminOrderRow } from '../orders/admin/admin-order.mappers.js';

/** Orders that count as money in (SPEC §7.3: "total spent" leaves out cancelled and returned). */
const NOT_COUNTED = ['CANCELLED', 'RETURNED'];

export type CustomerRow = Pick<UserLean, '_id' | 'name' | 'email' | 'phone' | 'companyName' | 'status' | 'createdAt'> & {
  orderCount: number;
  totalSpent: number;
};

export interface CustomerFilters {
  q?: string;
  status?: UserStatus;
}

/**
 * The customer directory (SPEC §7.3 "Customers"). Aggregation pipelines bypass `sanitizeFilter`, so
 * every value here comes from a validated DTO and search text is regex-escaped.
 */
@Injectable()
export class CustomersRepository {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
  ) {}

  async list(filters: CustomerFilters, page: number, pageSize: number): Promise<Paginated<CustomerRow>> {
    const match = this.match(filters);
    const [rows, total] = await Promise.all([
      this.users
        .aggregate<CustomerRow>([
          { $match: match },
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          ...this.withOrderStats(),
          { $project: { name: 1, email: 1, phone: 1, companyName: 1, status: 1, createdAt: 1, orderCount: 1, totalSpent: 1 } },
        ])
        .exec(),
      this.users.countDocuments(match).exec(),
    ]);
    return new Paginated(rows, { page, pageSize, total });
  }

  /** Every customer matching the list filters, newest first, streamed (Excel export, SPEC §7.3). */
  exportCursor(filters: CustomerFilters): AsyncIterable<CustomerRow> {
    return this.users
      .aggregate<CustomerRow>([
        { $match: this.match(filters) },
        { $sort: { createdAt: -1, _id: -1 } },
        ...this.withOrderStats(),
        { $project: { name: 1, email: 1, phone: 1, companyName: 1, status: 1, createdAt: 1, orderCount: 1, totalSpent: 1 } },
      ])
      .cursor();
  }

  async findOne(id: string): Promise<(UserLean & { orderCount: number; totalSpent: number }) | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const [row] = await this.users
      .aggregate<UserLean & { orderCount: number; totalSpent: number }>([
        { $match: { _id: new Types.ObjectId(id), role: 'CUSTOMER' } },
        ...this.withOrderStats(),
        { $project: { passwordHash: 0 } },
      ])
      .exec();
    return row ?? null;
  }

  recentOrders(userId: Types.ObjectId, limit: number): Promise<AdminOrderRow[]> {
    return this.orders
      .find({ userId }, ADMIN_ORDER_ROW_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean<AdminOrderRow[]>()
      .exec();
  }

  /** Name, email or phone contains the text; a phone in any format also matches its +92 form. */
  private match(filters: CustomerFilters): Record<string, unknown> {
    const match: Record<string, unknown> = { role: 'CUSTOMER' };
    if (filters.status) match.status = filters.status;
    const q = filters.q?.trim();
    if (q) {
      const contains = new RegExp(escapeRegExp(q), 'i');
      const or: Record<string, unknown>[] = [{ name: contains }, { email: contains }, { phone: contains }];
      const phone = normalizePkPhone(q);
      if (phone) or.push({ phone });
      match.$or = or;
    }
    return match;
  }

  private withOrderStats(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: this.orders.collection.name,
          localField: '_id',
          foreignField: 'userId',
          pipeline: [
            {
              $group: {
                _id: null,
                orderCount: { $sum: 1 },
                totalSpent: { $sum: { $cond: [{ $in: ['$status', NOT_COUNTED] }, 0, '$total'] } },
              },
            },
          ],
          as: 'stats',
        },
      },
      {
        $set: {
          orderCount: { $ifNull: [{ $first: '$stats.orderCount' }, 0] },
          totalSpent: { $ifNull: [{ $first: '$stats.totalSpent' }, 0] },
        },
      },
      { $unset: 'stats' },
    ];
  }
}
