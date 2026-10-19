import { computeCart, type CartDeliveryArea, type CartItem, type PricedCart } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import type { DeliveryAreaLean } from '../../models/delivery-area.model.js';
import type { StoreSettings } from '../../models/settings.model.js';
import { DeliveryAreasRepository } from '../delivery/delivery-areas.repository.js';
import { SettingsService } from '../settings/settings.service.js';
import { CartProductsRepository, toCartProductData, type PricingProduct } from './cart-products.repository.js';

/** Everything a priced cart was computed from, for callers that act on it (order placement). */
export interface CartPricingContext {
  cart: PricedCart;
  products: ReadonlyMap<string, PricingProduct>;
  area: DeliveryAreaLean | null;
  settings: StoreSettings;
}

function toCartArea(area: DeliveryAreaLean): CartDeliveryArea {
  return {
    id: String(area._id),
    name: area.name,
    isServiceable: area.isServiceable,
    deliveryFee: area.deliveryFee,
    freeDeliveryAbove: area.freeDeliveryAbove,
  };
}

/**
 * Prices carts on the server (SPEC §6.1–6.4) with the shared `computeCart()`, from current product
 * data, the delivery area and settings. The single place the API turns cart lines into money.
 */
@Injectable()
export class CartPricingService {
  constructor(
    private readonly products: CartProductsRepository,
    private readonly areas: DeliveryAreasRepository,
    private readonly settings: SettingsService,
  ) {}

  /** `areaId` that doesn't exist (a stale estimate cookie) prices the cart without delivery. */
  async price(items: readonly CartItem[], areaId?: string | null): Promise<PricedCart> {
    return (await this.priceWithContext(items, areaId)).cart;
  }

  /**
   * With a `session`, every read is part of that transaction (order placement prices the cart from
   * the same snapshot it writes to), one after another as transactions require.
   */
  async priceWithContext(
    items: readonly CartItem[],
    areaId?: string | null,
    session?: ClientSession,
  ): Promise<CartPricingContext> {
    const loadProducts = () => this.products.findForPricing(items.map((item) => item.productId), session);
    const loadArea = () => (areaId ? this.areas.findById(areaId, session) : Promise.resolve(null));
    const loadSettings = () => this.settings.get(session);
    const [products, area, settings] = session
      ? [await loadProducts(), await loadArea(), await loadSettings()]
      : await Promise.all([loadProducts(), loadArea(), loadSettings()]);
    const lines = items.map((item) => {
      const product = products.get(item.productId);
      return { item, product: product ? toCartProductData(product, item.variantId) : null };
    });
    return { cart: computeCart(lines, area ? toCartArea(area) : null, settings), products, area, settings };
  }
}
