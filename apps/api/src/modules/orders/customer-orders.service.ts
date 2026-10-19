import { CACHE_TAGS, checkTransition, type CustomerOrderDTO, type CustomerOrderListItemDTO, type ReorderResultDTO } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { Paginated } from '../../common/http/envelope.js';
import { AppConfig } from '../../config/app-config.service.js';
import { TransactionService } from '../../database/transaction.service.js';
import type { OrderLean } from '../../models/order.model.js';
import { CartService } from '../cart/cart.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { REVALIDATE_STOCK_MS, RevalidationService } from '../revalidation/revalidation.service.js';
import { toCustomerOrderDto, toOrderListItem, toStateSnapshot } from './order.mappers.js';
import { OrdersRepository } from './orders.repository.js';
import { OrderStockService } from './order-stock.service.js';

const ORDER_NOT_FOUND = "We couldn't find that order.";

/** A customer's own orders (SPEC §7.2 "Orders (customer)"). Someone else's order is always a 404. */
@Injectable()
export class CustomerOrdersService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly orders: OrdersRepository,
    private readonly orderStock: OrderStockService,
    private readonly cart: CartService,
    private readonly notifications: NotificationsService,
    private readonly revalidation: RevalidationService,
    private readonly config: AppConfig,
  ) {}

  async list(userId: string, page: number, pageSize: number): Promise<Paginated<CustomerOrderListItemDTO>> {
    const result = await this.orders.listOwn(userId, page, pageSize);
    return new Paginated(result.data.map(toOrderListItem), result.meta);
  }

  async detail(userId: string, orderNumber: string): Promise<CustomerOrderDTO> {
    return this.toDto(await this.findOwn(userId, orderNumber));
  }

  async toDto(order: OrderLean): Promise<CustomerOrderDTO> {
    const slugs = await this.orders.productSlugs(order.items.map((item) => item.productId));
    return toCustomerOrderDto(order, slugs);
  }

  /**
   * The customer's own cancel (SPEC §6.7): only while `NEW` and no receipt approved. Status, history
   * and the restock (`CANCEL` movements) are one transaction; the email goes after commit.
   */
  async cancel(userId: string, orderNumber: string, reason: string): Promise<CustomerOrderDTO> {
    const cancelled = await this.transactions.run(async (session) => {
      const order = await this.findOwn(userId, orderNumber, session);
      const check = checkTransition(toStateSnapshot(order), 'CANCELLED', { type: 'customer' }, { reason });
      if (!check.ok) throw new AppError(check.code, check.message);

      const updated = await this.orders.cancelByCustomer(order._id, order.userId, reason, new Date(), session);
      // A staff action got there first (confirmed, or a receipt approved).
      if (!updated) {
        throw new AppError('INVALID_TRANSITION', 'This order can no longer be cancelled here. Contact us on WhatsApp.');
      }
      await this.orderStock.restock(updated, 'CANCEL', `Order ${updated.orderNumber} cancelled by the customer`, undefined, session);
      return updated;
    });

    const dto = await this.toDto(cancelled);
    // Stock came back: refresh the lists and these product pages (batched, SPEC §14).
    const slugs = dto.items.flatMap((item) => (item.productSlug ? [CACHE_TAGS.product(item.productSlug)] : []));
    this.revalidation.revalidate([CACHE_TAGS.catalog, ...slugs], REVALIDATE_STOCK_MS);
    await this.notifications.notify('order.cancelled', {
      to: cancelled.user.email,
      name: cancelled.user.name,
      orderNumber: cancelled.orderNumber,
      reason,
      orderUrl: `${this.config.get('APP_URL')}/account/orders/${cancelled.orderNumber}`,
    });
    return dto;
  }

  /** `POST /api/orders/:orderNumber/reorder`: puts what can still be bought back in the cart. */
  async reorder(userId: string, orderNumber: string): Promise<ReorderResultDTO> {
    const order = await this.findOwn(userId, orderNumber);
    return this.cart.addLines(
      userId,
      order.items.map((item) => ({
        productId: String(item.productId),
        variantId: String(item.variantId),
        qty: item.qty,
        productName: item.productName,
        variantLabel: item.variantLabel,
      })),
    );
  }

  /** The customer's own order, or a 404 (also for someone else's order). */
  findOwnOrThrow(userId: string, orderNumber: string): Promise<OrderLean> {
    return this.findOwn(userId, orderNumber);
  }

  private async findOwn(userId: string, orderNumber: string, session?: ClientSession): Promise<OrderLean> {
    const order = await this.orders.findOwn(userId, orderNumber, session);
    if (!order) throw AppError.notFound(ORDER_NOT_FOUND);
    return order;
  }
}
