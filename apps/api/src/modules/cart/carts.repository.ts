import type { CartItem } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type ClientSession, type Model } from 'mongoose';
import { Cart, type CartLean } from '../../models/cart.model.js';

/** `carts` (SPEC §5.7): one per customer; quantities only, never prices. */
@Injectable()
export class CartsRepository {
  constructor(@InjectModel(Cart.name) private readonly model: Model<Cart>) {}

  /** The customer's cart lines (empty when they have no cart yet). */
  async items(userId: string, session?: ClientSession): Promise<CartItem[]> {
    const cart = await this.model
      .findOne({ userId: new Types.ObjectId(userId) }, { items: 1 }, { session })
      .lean<Pick<CartLean, 'items'>>()
      .exec();
    return (cart?.items ?? []).map((item) => ({
      productId: String(item.productId),
      variantId: String(item.variantId),
      qty: item.qty,
    }));
  }

  /** Replaces the lines (creating the cart on first use). Last write wins, like any single-user cart. */
  async save(userId: string, items: readonly CartItem[]): Promise<void> {
    await this.model
      .updateOne(
        { userId: new Types.ObjectId(userId) },
        {
          $set: {
            items: items.map((item) => ({
              productId: new Types.ObjectId(item.productId),
              variantId: new Types.ObjectId(item.variantId),
              qty: item.qty,
            })),
          },
        },
        { upsert: true, runValidators: true },
      )
      .exec();
  }

  async removeItem(userId: string, variantId: string): Promise<void> {
    await this.model
      .updateOne({ userId: new Types.ObjectId(userId) }, { $pull: { items: { variantId: new Types.ObjectId(variantId) } } })
      .exec();
  }

  /** Empties the cart; part of the order transaction (SPEC §6.6). */
  async clear(userId: string, session?: ClientSession): Promise<void> {
    await this.model.updateOne({ userId: new Types.ObjectId(userId) }, { $set: { items: [] } }, { session }).exec();
  }
}
