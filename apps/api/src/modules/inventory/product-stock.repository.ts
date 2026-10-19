import type { StockMovementReason } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { type ClientSession, type Model, type Types } from 'mongoose';
import { Product, recomputeProductStock, type Variant } from '../../models/product.model.js';
import { StockMovement, type StockMovementRefType } from '../../models/stock-movement.model.js';

const { trusted } = mongoose;

export interface StockLine {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  qty: number;
}

export interface MovementInput {
  line: StockLine;
  /** Signed: negative when stock goes down. */
  change: number;
  stockAfter: number;
  reason: StockMovementReason;
  refType?: StockMovementRefType;
  refId?: Types.ObjectId;
  note?: string;
  byUserId?: Types.ObjectId;
  at: Date;
}

type VariantStock = { variants: Pick<Variant, '_id' | 'stock'>[] };

/** Only the one variant, so the update returns its new stock. */
const variantProjection = (variantId: Types.ObjectId) => ({ variants: { $elemMatch: { _id: variantId } } });

/**
 * Every stock change goes through here (SPEC §6.10), always inside a transaction, and always with a
 * `stockMovements` row. A sale or restock is not a product edit, so `updatedAt` is left alone.
 */
@Injectable()
export class ProductStockRepository {
  constructor(
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(StockMovement.name) private readonly movements: Model<StockMovement>,
  ) {}

  /**
   * Takes `qty` atomically, only while the product is active, the variant active and stock ≥ qty
   * (SPEC §6.6 step 4: the condition and the decrement are one operation, so two orders can never
   * both take the last units). Returns the stock left, or null when the condition failed.
   */
  async take(line: StockLine, session: ClientSession): Promise<number | null> {
    const updated = await this.products
      .findOneAndUpdate(
        {
          _id: line.productId,
          status: 'active',
          variants: trusted({ $elemMatch: { _id: line.variantId, isActive: true, stock: { $gte: line.qty } } }),
        },
        { $inc: { 'variants.$.stock': -line.qty } },
        { returnDocument: 'after', session, timestamps: false, projection: variantProjection(line.variantId) },
      )
      .lean<VariantStock>()
      .exec();
    return updated?.variants[0]?.stock ?? null;
  }

  /** Puts `qty` back (cancel/return), whatever the product's status. Null if the variant is gone. */
  async putBack(line: StockLine, session: ClientSession): Promise<number | null> {
    const updated = await this.products
      .findOneAndUpdate(
        { _id: line.productId, 'variants._id': line.variantId },
        { $inc: { 'variants.$.stock': line.qty } },
        { returnDocument: 'after', session, timestamps: false, projection: variantProjection(line.variantId) },
      )
      .lean<VariantStock>()
      .exec();
    return updated?.variants[0]?.stock ?? null;
  }

  /**
   * Manual adjustment (SPEC §6.10): adds `change` (negative removes) in one operation that refuses to
   * go below 0. Returns the stock after, or null when the variant is gone or there isn't enough.
   */
  async adjust(productId: Types.ObjectId, variantId: Types.ObjectId, change: number, session: ClientSession): Promise<number | null> {
    const enough = change < 0 ? { stock: { $gte: -change } } : {};
    const updated = await this.products
      .findOneAndUpdate(
        { _id: productId, variants: trusted({ $elemMatch: { _id: variantId, ...enough } }) },
        { $inc: { 'variants.$.stock': change } },
        { returnDocument: 'after', session, timestamps: false, projection: variantProjection(variantId) },
      )
      .lean<VariantStock>()
      .exec();
    return updated?.variants[0]?.stock ?? null;
  }

  /** `totalStock` / price range after variant stock changed with `$inc` (which skips the hooks). */
  recomputeTotals(productIds: readonly Types.ObjectId[], session: ClientSession): Promise<void> {
    return recomputeProductStock(this.products, productIds, session);
  }

  async recordMovements(inputs: readonly MovementInput[], session: ClientSession): Promise<void> {
    if (inputs.length === 0) return;
    await this.movements.insertMany(
      inputs.map((input) => ({
        productId: input.line.productId,
        variantId: input.line.variantId,
        sku: input.line.sku,
        change: input.change,
        stockAfter: input.stockAfter,
        reason: input.reason,
        refType: input.refType,
        refId: input.refId,
        note: input.note,
        byUserId: input.byUserId,
        at: input.at,
      })),
      { session },
    );
  }
}
