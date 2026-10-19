import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types, type ClientSession, type Model } from 'mongoose';
import { Paginated } from '../../common/http/envelope.js';
import { BaseRepository } from '../../database/base.repository.js';
import { Order, type OrderLean } from '../../models/order.model.js';
import { Product } from '../../models/product.model.js';

const { trusted } = mongoose;

/** A row of the customer's order list. */
export type OrderListRow = Pick<
  OrderLean,
  '_id' | 'orderNumber' | 'createdAt' | 'total' | 'paymentMethod' | 'paymentStatus' | 'status'
> & { items: { qty: number }[] };

/** Fields of a new order; the repository adds nothing, the service builds every snapshot. */
export type NewOrder = Omit<OrderLean, 'createdAt' | 'updatedAt'>;

@Injectable()
export class OrdersRepository extends BaseRepository<Order, OrderLean> {
  constructor(
    @InjectModel(Order.name) model: Model<Order>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
  ) {
    super(model);
  }

  /** SPEC §6.6 step 1: the order an `Idempotency-Key` already produced for this customer. */
  findByIdempotencyKey(userId: string, key: string, session?: ClientSession): Promise<OrderLean | null> {
    return this.findOne({ userId: new Types.ObjectId(userId), idempotencyKey: key }, session);
  }

  /** Customers only ever see their own orders; anyone else's is simply "not found". */
  findOwn(userId: string, orderNumber: string, session?: ClientSession): Promise<OrderLean | null> {
    return this.findOne({ userId: new Types.ObjectId(userId), orderNumber }, session);
  }

  async listOwn(userId: string, page: number, pageSize: number): Promise<Paginated<OrderListRow>> {
    const filter = { userId: new Types.ObjectId(userId) };
    const [rows, total] = await Promise.all([
      this.model
        .find(filter, { orderNumber: 1, createdAt: 1, total: 1, paymentMethod: 1, paymentStatus: 1, status: 1, 'items.qty': 1 })
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<OrderListRow[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return new Paginated(rows, { page, pageSize, total });
  }

  /** Inserts with the schema's validators and totals check (SPEC §6.2). */
  async create(order: NewOrder, session: ClientSession): Promise<OrderLean> {
    const [created] = await this.model.create([order], { session });
    if (!created) throw new Error('The order was not created.');
    return created.toObject<OrderLean>();
  }

  /**
   * The customer's own cancel (SPEC §6.7): only while still `NEW` and no receipt is approved —
   * checked in the update itself, so a staff action in between wins. Null when that no longer holds.
   */
  cancelByCustomer(
    orderId: Types.ObjectId,
    userId: Types.ObjectId,
    reason: string,
    now: Date,
    session: ClientSession,
  ): Promise<OrderLean | null> {
    return this.model
      .findOneAndUpdate(
        { _id: orderId, status: 'NEW', receipts: trusted({ $not: { $elemMatch: { status: 'approved' } } }) },
        {
          $set: { status: 'CANCELLED', cancelReason: reason },
          $push: { statusHistory: { status: 'CANCELLED', at: now, byUserId: userId, byType: 'customer', note: reason } },
        },
        { returnDocument: 'after', session, runValidators: true },
      )
      .lean<OrderLean>()
      .exec();
  }

  /**
   * A bank-transfer receipt the customer uploaded (SPEC §6.8): pending, and the payment now awaits
   * verification. Runs in the caller's transaction after `canUploadReceipt()`, so two uploads at
   * the same moment conflict and the retry sees the first one.
   */
  addReceipt(
    orderId: Types.ObjectId,
    receipt: { _id: Types.ObjectId; key: string; mimeType: Order['receipts'][number]['mimeType']; sizeBytes: number; uploadedAt: Date },
    session: ClientSession,
  ): Promise<OrderLean | null> {
    return this.model
      .findOneAndUpdate(
        { _id: orderId },
        { $push: { receipts: { ...receipt, status: 'pending' } }, $set: { paymentStatus: 'AWAITING_VERIFICATION' } },
        { returnDocument: 'after', session, runValidators: true },
      )
      .lean<OrderLean>()
      .exec();
  }

  /** Current slugs of the ordered products, to link order lines to product pages. */
  async productSlugs(productIds: readonly Types.ObjectId[]): Promise<Map<string, string>> {
    if (productIds.length === 0) return new Map();
    const products = await this.products
      .find({ _id: trusted({ $in: [...productIds] }), status: 'active' }, { slug: 1 })
      .lean<{ _id: Types.ObjectId; slug: string }[]>()
      .exec();
    return new Map(products.map((product) => [String(product._id), product.slug]));
  }
}
