import {
  CACHE_TAGS,
  codLimitMessage,
  isPaymentMethodAllowed,
  type CartItem,
  notServiceableMessage,
  type PaymentMethod,
  type PricedCart,
} from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { isDuplicateKey } from '../../common/errors/mongo-errors.js';
import { AppConfig } from '../../config/app-config.service.js';
import { TransactionService } from '../../database/transaction.service.js';
import type { OrderLean } from '../../models/order.model.js';
import type { StoreSettings } from '../../models/settings.model.js';
import { AuditService, type AuditActor } from '../audit/audit.service.js';
import { CartPricingService } from '../cart/cart-pricing.service.js';
import { CartsRepository } from '../cart/carts.repository.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { REVALIDATE_STOCK_MS, RevalidationService } from '../revalidation/revalidation.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { toOrderItem } from './order.mappers.js';
import { OrderNumbersRepository } from './order-numbers.repository.js';
import { newTrackingCode } from './order-tracking-code.js';
import { OrdersRepository } from './orders.repository.js';
import { ProductStockRepository, type MovementInput } from '../inventory/product-stock.repository.js';

export interface PlaceOrderInput {
  addressId: string;
  paymentMethod: PaymentMethod;
  customerNote?: string;
  expectedTotal: number;
}

/** Set when staff place the order for a customer (SPEC §6.6a): the lines come from the request, not a cart. */
export interface StaffPlacement {
  actor: AuditActor;
  items: readonly CartItem[];
  /** Rupees off the subtotal, with the reason (SPEC §6.6c). The caller has checked the permission. */
  discount?: { amount: number; reason: string };
}

export interface PlacedOrder {
  order: OrderLean;
  /** false when the Idempotency-Key already produced this order (answer 200, not 201). */
  created: boolean;
}

interface PlacementResult extends PlacedOrder {
  /** Set when the order was created now (for the emails). */
  settings: StoreSettings | null;
  productSlugs: string[];
}

const fieldError = (path: string, message: string) => AppError.validation(message, [{ path, message }]);

/**
 * `POST /api/orders` (SPEC §6.6). Everything from reading the cart to emptying it runs in **one
 * transaction on one snapshot**: prices, stock, settings and the address are read and written
 * together. If another order (or an admin price edit) commits in between, MongoDB reports a write
 * conflict and the driver re-runs the whole callback on fresh data — so the customer either gets
 * the order at the price they saw, or a clear 409 (`OUT_OF_STOCK`, `PRICE_CHANGED`). Overselling is
 * impossible: the stock decrement itself carries the `stock ≥ qty` condition.
 */
@Injectable()
export class OrderPlacementService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly orders: OrdersRepository,
    private readonly stock: ProductStockRepository,
    private readonly orderNumbers: OrderNumbersRepository,
    private readonly carts: CartsRepository,
    private readonly users: UsersRepository,
    private readonly pricing: CartPricingService,
    private readonly notifications: NotificationsService,
    private readonly revalidation: RevalidationService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  async place(userId: string, input: PlaceOrderInput, idempotencyKey: string, staff?: StaffPlacement): Promise<PlacedOrder> {
    // Step 1: a retry of a request that already succeeded gets the same order back.
    const existing = await this.orders.findByIdempotencyKey(userId, idempotencyKey);
    if (existing) return { order: existing, created: false };

    let result: PlacementResult | undefined;
    // Two orders picking the same 6-digit code at the same moment is rare; the unique index catches it and we pick again.
    for (let attempt = 0; result === undefined; attempt += 1) {
      try {
        result = await this.transactions.run((session) => this.placeInTransaction(userId, input, idempotencyKey, session, staff));
      } catch (error) {
        if (isDuplicateKey(error, 'trackingCode') && attempt < 4) continue;
        // The same key raced itself (double submit): the unique index let one through; return that one.
        if (isDuplicateKey(error, 'idempotencyKey')) {
          const order = await this.orders.findByIdempotencyKey(userId, idempotencyKey);
          if (order) return { order, created: false };
        }
        throw error;
      }
    }

    // Step 5: after commit (emails must never be sent for a rolled-back order).
    if (result.created && result.settings) {
      // Stock changed: "in stock" badges and "Only N left" on these products (batched, SPEC §14).
      this.revalidation.revalidate([CACHE_TAGS.catalog, ...result.productSlugs.map(CACHE_TAGS.product)], REVALIDATE_STOCK_MS);
      await this.notifyPlaced(result.order, result.settings);
    }
    return { order: result.order, created: result.created };
  }

  /** Steps 2–4. Safe to run more than once: the driver retries it on write conflicts. */
  private async placeInTransaction(
    userId: string,
    input: PlaceOrderInput,
    idempotencyKey: string,
    session: ClientSession,
    staff?: StaffPlacement,
  ): Promise<PlacementResult> {
    const again = await this.orders.findByIdempotencyKey(userId, idempotencyKey, session);
    if (again) return { order: again, created: false, settings: null, productSlugs: [] };

    // Step 2: load and validate.
    const user = await this.users.findById(userId, session);
    if (staff) {
      if (!user || user.role !== 'CUSTOMER') throw fieldError('userId', "We couldn't find that customer.");
      if (user.status !== 'active') throw fieldError('userId', 'This customer is blocked. Unblock them before creating an order.');
    } else if (!user) {
      throw AppError.unauthenticated();
    }
    const address = user.addresses.find((item) => String(item._id) === input.addressId);
    if (!address) throw fieldError('addressId', staff ? "Choose one of this customer's saved addresses." : 'Choose one of your saved addresses.');

    const items = staff ? [...staff.items] : await this.carts.items(userId, session);
    if (items.length === 0) {
      throw AppError.validation(staff ? 'Add at least one product.' : 'Your cart is empty. Add something before placing an order.');
    }

    const { cart, area, settings } = await this.pricing.priceWithContext(items, String(address.areaId), session);
    if (!area) throw fieldError('addressId', "We don't deliver to this address's area. Choose another address.");
    if (!area.isServiceable) throw fieldError('addressId', notServiceableMessage(area.name));
    this.assertNoLineIssues(cart);
    // Staff may take an amount off the subtotal (never the delivery fee); the discounted total is what the customer pays.
    const discount = staff?.discount?.amount ?? 0;
    if (discount > cart.subtotal) throw fieldError('discountAmount', "The discount can't be more than the order subtotal.");
    const payable = cart.total - discount;
    if (!isPaymentMethodAllowed(input.paymentMethod, settings, payable)) {
      // COD that is switched on can only fail on the limit (SPEC §6.5); anything else is switched off.
      const codLimit = settings.codMaxOrderAmount;
      throw fieldError(
        'paymentMethod',
        input.paymentMethod === 'COD' && settings.paymentMethods.cod && codLimit !== null
          ? codLimitMessage(codLimit)
          : 'This payment method is not available. Choose another one.',
      );
    }

    // Step 3: the server's prices are the only ones that count.
    if (payable !== input.expectedTotal) {
      throw new AppError('PRICE_CHANGED', 'Prices changed since you opened checkout. Review your order and place it again.', {
        cart,
      });
    }

    // Step 4: stock, number, order, movements, cart — all or nothing.
    const now = new Date();
    const orderId = new Types.ObjectId();
    let trackingCode = newTrackingCode();
    while (await this.orders.trackingCodeTaken(trackingCode, session)) trackingCode = newTrackingCode();
    const movements: MovementInput[] = [];
    for (const pricedLine of cart.lines) {
      const item = toOrderItem(pricedLine);
      const line = { productId: item.productId, variantId: item.variantId, sku: item.sku, qty: item.qty };
      const stockAfter = await this.stock.take(line, session);
      if (stockAfter === null) {
        throw new AppError('OUT_OF_STOCK', `There isn't enough stock of ${item.productName} (${item.variantLabel}) any more.`, {
          cart,
        });
      }
      movements.push({ line, change: -item.qty, stockAfter, reason: 'ORDER', refType: 'order', refId: orderId, at: now });
    }
    await this.stock.recomputeTotals(
      movements.map((movement) => movement.line.productId),
      session,
    );

    const order = await this.orders.create(
      {
        _id: orderId,
        orderNumber: await this.orderNumbers.next(now, session),
        trackingCode,
        userId: user._id,
        user: { name: user.name, email: user.email, phone: user.phone ?? address.phone },
        shippingAddress: {
          label: address.label,
          contactName: address.contactName,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          landmark: address.landmark,
          areaId: address.areaId,
          areaName: area.name,
          city: address.city,
        },
        deliveryAreaId: area._id,
        items: cart.lines.map(toOrderItem),
        subtotal: cart.subtotal,
        deliveryFee: cart.deliveryFee ?? 0,
        discountAmount: discount,
        ...(staff?.discount && discount > 0
          ? { discountReason: staff.discount.reason, discountByUserId: new Types.ObjectId(staff.actor.id) }
          : {}),
        total: payable,
        paymentMethod: input.paymentMethod,
        paymentStatus: 'PENDING',
        receipts: [],
        status: 'NEW',
        statusHistory: [
          staff
            ? { status: 'NEW', at: now, byUserId: new Types.ObjectId(staff.actor.id), byType: 'staff' }
            : { status: 'NEW', at: now, byUserId: user._id, byType: 'customer' },
        ],
        customerNote: input.customerNote,
        idempotencyKey,
      },
      session,
    );
    await this.stock.recordMovements(movements, session);
    if (staff) {
      await this.audit.record(
        staff.actor,
        {
          action: 'order.created',
          entity: 'order',
          entityId: String(order._id),
          after: {
            orderNumber: order.orderNumber,
            customerId: userId,
            total: order.total,
            paymentMethod: order.paymentMethod,
            ...(discount > 0 && { discount, discountReason: staff.discount?.reason }),
          },
        },
        session,
      );
    } else {
      await this.carts.clear(userId, session);
    }
    return { order, created: true, settings, productSlugs: cart.lines.flatMap((line) => (line.slug ? [line.slug] : [])) };
  }

  /** Every line must be buyable as it is; the fresh cart goes back so the page can show what changed. */
  private assertNoLineIssues(cart: PricedCart): void {
    const issues = cart.lines.flatMap((line) => (line.issue ? [line.issue.code] : []));
    if (issues.includes('PRODUCT_UNAVAILABLE')) {
      throw AppError.conflict('Some items in your cart are no longer available. Review your cart.', { cart });
    }
    if (issues.length > 0) {
      throw new AppError('OUT_OF_STOCK', "Some items don't have enough stock. Review your cart.", { cart });
    }
  }

  private async notifyPlaced(order: OrderLean, settings: StoreSettings): Promise<void> {
    const appUrl = this.config.get('APP_URL');
    await this.notifications.notify('order.placed', {
      to: order.user.email,
      name: order.user.name,
      orderNumber: order.orderNumber,
      trackingCode: order.trackingCode ?? null,
      orderUrl: `${appUrl}/account/orders/${order.orderNumber}`,
      items: order.items.map(({ productName, variantLabel, qty, unitPrice, lineTotal }) => ({
        productName,
        variantLabel,
        qty,
        unitPrice,
        lineTotal,
      })),
      subtotal: order.subtotal,
      discount: order.discountAmount,
      deliveryFee: order.deliveryFee,
      total: order.total,
      paymentMethod: order.paymentMethod,
      bankTransfer:
        order.paymentMethod === 'BANK_TRANSFER'
          ? {
              accounts: settings.bankAccounts.map((account) => ({
                bankName: account.bankName,
                accountTitle: account.accountTitle,
                accountNumber: account.accountNumber,
                iban: account.iban || null,
              })),
              instructions: settings.bankTransferInstructions,
            }
          : null,
    });
    if (settings.orderNotificationEmails.length > 0) {
      await this.notifications.notify('order.placed.staff', {
        to: settings.orderNotificationEmails,
        orderNumber: order.orderNumber,
        customerName: order.user.name,
        customerPhone: order.user.phone,
        areaName: order.shippingAddress.areaName,
        total: order.total,
        paymentMethod: order.paymentMethod,
        adminUrl: `${appUrl}/admin/orders/${String(order._id)}`,
      });
    }
  }
}
