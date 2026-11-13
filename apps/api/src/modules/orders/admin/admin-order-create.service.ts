import { hasPermission, type AdminOrderDTO, type AdminOrderProductOptionDTO, type PermissionSubject, type PricedCart } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error.js';
import type { AuditActor } from '../../audit/audit.service.js';
import { CartPricingService } from '../../cart/cart-pricing.service.js';
import { CartProductsRepository } from '../../cart/cart-products.repository.js';
import { UsersRepository } from '../../users/users.repository.js';
import { OrderPlacementService, type PlaceOrderInput } from '../order-placement.service.js';
import { AdminOrdersService } from './admin-orders.service.js';

export interface StaffOrderLines {
  userId: string;
  addressId: string;
  items: { productId: string; variantId: string; qty: number }[];
  /** Rupees off the subtotal (SPEC §6.6c). */
  discountAmount?: number;
}

export interface StaffOrderInput extends StaffOrderLines, PlaceOrderInput {
  discountReason?: string;
}

const OPTION_LIMIT = 20;

/**
 * Orders staff create for a customer (SPEC §6.6a). Prices, stock and totals come from the same
 * code as customer checkout (`OrderPlacementService`); staff only choose the customer, address,
 * lines and payment method.
 */
@Injectable()
export class AdminOrderCreateService {
  constructor(
    private readonly placement: OrderPlacementService,
    private readonly pricing: CartPricingService,
    private readonly products: CartProductsRepository,
    private readonly users: UsersRepository,
    private readonly adminOrders: AdminOrdersService,
  ) {}

  /** Active variants matching the search, flat (one row per sellable variant). */
  async productOptions(q: string): Promise<AdminOrderProductOptionDTO[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const products = await this.products.searchActive(term, OPTION_LIMIT);
    return products.flatMap((product) =>
      product.variants
        .filter((variant) => variant.isActive)
        .map((variant) => ({
          productId: String(product._id),
          variantId: String(variant._id),
          productName: product.name,
          variantLabel: variant.label,
          sku: variant.sku,
          price: variant.price,
          stock: variant.stock,
        })),
    );
  }

  /** A discount needs `orders.discount`, a reason, and can't be more than the subtotal. */
  private checkDiscount(viewer: PermissionSubject, amount: number | undefined, reason: string | undefined, subtotal?: number): void {
    if (!amount) return;
    if (!hasPermission(viewer, 'orders.discount')) throw AppError.forbidden("You don't have permission to give a discount.");
    if (reason !== undefined && reason.trim() === '') {
      const message = 'Add a reason for the discount.';
      throw AppError.validation(message, [{ path: 'discountReason', message }]);
    }
    if (subtotal !== undefined && amount > subtotal) {
      const message = "The discount can't be more than the order subtotal.";
      throw AppError.validation(message, [{ path: 'discountAmount', message }]);
    }
  }

  /** The server's price for these lines and this customer's delivery area, discount taken off (nothing is saved). */
  async quote(viewer: PermissionSubject, input: StaffOrderLines): Promise<PricedCart & { discount: number }> {
    const user = await this.users.findById(input.userId);
    if (!user || user.role !== 'CUSTOMER') throw AppError.validation("We couldn't find that customer.", [{ path: 'userId', message: "We couldn't find that customer." }]);
    const address = user.addresses.find((item) => String(item._id) === input.addressId);
    if (!address) {
      const message = "Choose one of this customer's saved addresses.";
      throw AppError.validation(message, [{ path: 'addressId', message }]);
    }
    const cart = await this.pricing.price(input.items, String(address.areaId));
    const discount = input.discountAmount ?? 0;
    this.checkDiscount(viewer, discount, undefined, cart.subtotal);
    return { ...cart, discount, total: cart.total - discount };
  }

  async create(
    actor: AuditActor,
    viewer: PermissionSubject,
    input: StaffOrderInput,
    idempotencyKey: string,
  ): Promise<{ order: AdminOrderDTO; created: boolean }> {
    const amount = input.discountAmount ?? 0;
    // The reason is checked here (it is required whenever a discount is given); the subtotal limit in the placement.
    this.checkDiscount(viewer, amount, input.discountReason?.trim() ?? '', undefined);
    const discount = amount > 0 ? { amount, reason: (input.discountReason ?? '').trim() } : undefined;
    const { order, created } = await this.placement.place(input.userId, input, idempotencyKey, { actor, items: input.items, discount });
    return { order: await this.adminOrders.detail(String(order._id)), created };
  }
}
