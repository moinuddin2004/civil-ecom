import { Injectable } from '@nestjs/common';
import type { ClientSession, Types } from 'mongoose';
import type { OrderLean } from '../../models/order.model.js';
import { ProductStockRepository, type MovementInput } from '../inventory/product-stock.repository.js';

/** Returns an order's stock (SPEC §6.7 cancel/return, §6.10). Always inside the status-change transaction. */
@Injectable()
export class OrderStockService {
  constructor(private readonly stock: ProductStockRepository) {}

  /** Every line goes back with a movement; a variant deleted since is skipped. */
  async restock(
    order: OrderLean,
    reason: 'CANCEL' | 'RETURN',
    note: string,
    byUserId: Types.ObjectId | undefined,
    session: ClientSession,
  ): Promise<void> {
    const now = new Date();
    const movements: MovementInput[] = [];
    for (const item of order.items) {
      const line = { productId: item.productId, variantId: item.variantId, sku: item.sku, qty: item.qty };
      const stockAfter = await this.stock.putBack(line, session);
      if (stockAfter === null) continue;
      movements.push({ line, change: item.qty, stockAfter, reason, refType: 'order', refId: order._id, note, byUserId, at: now });
    }
    await this.stock.recomputeTotals(
      movements.map((movement) => movement.line.productId),
      session,
    );
    await this.stock.recordMovements(movements, session);
  }
}
