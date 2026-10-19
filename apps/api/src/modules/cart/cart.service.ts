import { CART_MAX_LINES, mergeCartItems, QTY_MAX, type CartItem, type PricedCart, type ReorderResultDTO } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { CartPricingService } from './cart-pricing.service.js';
import { CartProductsRepository, type PricingProduct } from './cart-products.repository.js';
import { CartsRepository } from './carts.repository.js';

const UNAVAILABLE = 'This item is no longer available.';
const TOO_MANY_LINES = `A cart can hold up to ${CART_MAX_LINES} different items.`;

/** Stock a line can be bought up to: 0 unless the product and the variant are on sale. */
function availableStock(product: PricingProduct | undefined, variantId: string): number {
  if (!product || product.status !== 'active') return 0;
  const variant = product.variants.find((item) => String(item._id) === variantId);
  return variant?.isActive ? Math.max(variant.stock, 0) : 0;
}

/** Guest quotes and customer carts (SPEC §6.2–6.3, §7.2 "Cart"). Every response is freshly priced. */
@Injectable()
export class CartService {
  constructor(
    private readonly carts: CartsRepository,
    private readonly products: CartProductsRepository,
    private readonly pricing: CartPricingService,
  ) {}

  /** `POST /api/cart/quote`: prices a guest's `localStorage` cart. Repeated variants are combined. */
  quote(items: readonly CartItem[], areaId?: string): Promise<PricedCart> {
    return this.pricing.price(mergeCartItems([], items, () => QTY_MAX), areaId);
  }

  async get(userId: string, areaId?: string): Promise<PricedCart> {
    return this.pricing.price(await this.carts.items(userId), areaId);
  }

  /**
   * `PUT /api/cart/items`: sets a line's quantity (0 removes it). Only items on sale can be added;
   * a quantity above stock is kept and reported as `QTY_EXCEEDS_STOCK`, so the customer decides.
   */
  async setItem(userId: string, variantId: string, qty: number, areaId?: string): Promise<PricedCart> {
    if (qty === 0) return this.removeItem(userId, variantId, areaId);

    const product = await this.products.findByVariantId(variantId);
    const variant = product?.variants.find((item) => String(item._id) === variantId);
    if (!product || !variant || product.status !== 'active' || !variant.isActive) throw AppError.notFound(UNAVAILABLE);
    if (variant.stock <= 0) {
      throw new AppError('OUT_OF_STOCK', 'This item is out of stock.', [{ variantId, available: 0 }]);
    }

    const items = await this.carts.items(userId);
    const inCart = items.some((item) => item.variantId === variantId);
    if (!inCart && items.length >= CART_MAX_LINES) throw AppError.validation(TOO_MANY_LINES);

    const next = inCart
      ? items.map((item) => (item.variantId === variantId ? { ...item, qty } : item))
      : [...items, { productId: String(product._id), variantId, qty }];
    await this.carts.save(userId, next);
    return this.pricing.price(next, areaId);
  }

  async removeItem(userId: string, variantId: string, areaId?: string): Promise<PricedCart> {
    await this.carts.removeItem(userId, variantId);
    return this.get(userId, areaId);
  }

  /**
   * Reorder (SPEC §7.2): adds an old order's lines to the cart like a merge (quantities added,
   * capped at stock), and says which lines couldn't be added and why.
   */
  async addLines(
    userId: string,
    lines: readonly (CartItem & { productName: string; variantLabel: string })[],
  ): Promise<ReorderResultDTO> {
    const stored = await this.carts.items(userId);
    const products = await this.products.findForPricing([...stored, ...lines].map((item) => item.productId));
    const stockFor = (item: CartItem) => availableStock(products.get(item.productId), item.variantId);

    const skipped: ReorderResultDTO['skipped'] = [];
    const skip = (line: (typeof lines)[number], reason: string) =>
      skipped.push({ productName: line.productName, variantLabel: line.variantLabel, reason });

    const addable: CartItem[] = [];
    for (const line of lines) {
      const product = products.get(line.productId);
      const variant = product?.variants.find((item) => String(item._id) === line.variantId);
      if (!product || product.status !== 'active' || !variant?.isActive) skip(line, 'No longer available.');
      else if (stockFor(line) === 0) skip(line, 'Out of stock.');
      else addable.push({ productId: line.productId, variantId: line.variantId, qty: line.qty });
    }

    const itemByVariant = new Map([...stored, ...addable].map((item) => [item.variantId, item]));
    const merged = mergeCartItems(stored, addable, (variantId) => {
      const item = itemByVariant.get(variantId);
      return item ? stockFor(item) : 0;
    });
    const kept = merged.slice(0, CART_MAX_LINES);
    for (const dropped of merged.slice(CART_MAX_LINES)) {
      const line = lines.find((item) => item.variantId === dropped.variantId);
      if (line) skip(line, TOO_MANY_LINES);
    }

    await this.carts.save(userId, kept);
    return { cart: await this.pricing.price(kept), skipped };
  }

  /**
   * `POST /api/cart/merge` after login (SPEC §6.3): same variant → quantities added, every line
   * capped at current stock and 9,999; lines that can't be bought are dropped. Items whose variant
   * doesn't belong to the given product are ignored.
   */
  async merge(userId: string, incoming: readonly CartItem[], areaId?: string): Promise<PricedCart> {
    const stored = await this.carts.items(userId);
    const products = await this.products.findForPricing([...stored, ...incoming].map((item) => item.productId));
    const stockFor = (item: CartItem) => availableStock(products.get(item.productId), item.variantId);

    const valid = incoming.filter((item) => stockFor(item) > 0);
    const itemByVariant = new Map([...stored, ...valid].map((item) => [item.variantId, item]));
    const merged = mergeCartItems(stored, valid, (variantId) => {
      const item = itemByVariant.get(variantId);
      return item ? stockFor(item) : 0;
    }).slice(0, CART_MAX_LINES);

    await this.carts.save(userId, merged);
    return this.pricing.price(merged, areaId);
  }
}
