import { QTY_MAX } from './constants.js';
import {
  getDeliveryFee,
  notServiceableMessage,
  type DeliveryAreaPricing,
  type DeliverySettings,
} from './delivery.js';
import type { ProductStatus, Unit } from './enums.js';
import {
  getUnitPrice,
  lineSavings,
  lineTotal,
  nextTier,
  type BulkTier,
  type NextTier,
} from './pricing.js';

/**
 * Cart pricing (SPEC §6.2). Carts never store prices; this recomputes them from current product
 * data on every read, for guest quotes, logged-in carts and order placement alike.
 */

export interface CartItem {
  productId: string;
  variantId: string;
  qty: number;
}

/** Current product data for one cart line, loaded by the caller. */
export interface CartProductData {
  productId: string;
  slug: string;
  name: string;
  brandName: string;
  unit: Unit;
  status: ProductStatus;
  imageKey: string | null;
  variant: {
    id: string;
    sku: string;
    label: string;
    mrp: number;
    price: number;
    bulkTiers: readonly BulkTier[];
    stock: number;
    isActive: boolean;
  } | null;
}

export type CartLineIssueCode = 'PRODUCT_UNAVAILABLE' | 'OUT_OF_STOCK' | 'QTY_EXCEEDS_STOCK';

export interface CartLineIssue {
  code: CartLineIssueCode;
  message: string;
  /** For QTY_EXCEEDS_STOCK: the quantity the UI offers ("Set to 6"). */
  maxQty?: number;
}

export interface PricedCartLine {
  productId: string;
  variantId: string;
  qty: number;
  /** Product data; null only when the product no longer exists. */
  slug: string | null;
  productName: string;
  brandName: string;
  variantLabel: string;
  sku: string | null;
  unit: Unit | null;
  imageKey: string | null;
  mrp: number;
  basePrice: number;
  unitPrice: number;
  appliedTierMinQty: number | null;
  lineTotal: number;
  savings: number;
  nextTier: NextTier | null;
  stock: number;
  issue: CartLineIssue | null;
}

export type CartIssueCode = CartLineIssueCode | 'AREA_NOT_SERVICEABLE' | 'EMPTY_CART';

export interface CartIssue {
  code: CartIssueCode;
  message: string;
  variantId?: string;
}

export interface CartDeliveryArea extends DeliveryAreaPricing {
  id: string;
}

export interface PricedCart {
  lines: PricedCartLine[];
  /** Total units across lines that can be bought. */
  itemCount: number;
  subtotal: number;
  savings: number;
  /** null when no area is chosen or it isn't serviceable. */
  deliveryFee: number | null;
  total: number;
  amountToFreeDelivery: number | null;
  area: { id: string; name: string; isServiceable: boolean; freeDeliveryAbove: number | null } | null;
  issues: CartIssue[];
  /** No issues, at least one line and a serviceable area. */
  canCheckout: boolean;
}

function lineIssue(product: CartProductData | null, qty: number): CartLineIssue | null {
  const variant = product?.variant;
  if (!product || !variant || product.status !== 'active' || !variant.isActive) {
    return { code: 'PRODUCT_UNAVAILABLE', message: 'This item is no longer available.' };
  }
  if (variant.stock <= 0) {
    return { code: 'OUT_OF_STOCK', message: 'This item is out of stock.' };
  }
  if (qty > variant.stock) {
    return {
      code: 'QTY_EXCEEDS_STOCK',
      message: `Only ${variant.stock} in stock.`,
      maxQty: Math.min(variant.stock, QTY_MAX),
    };
  }
  return null;
}

function priceLine(item: CartItem, product: CartProductData | null): PricedCartLine {
  const variant = product?.variant ?? null;
  const issue = lineIssue(product, item.qty);
  if (!product || !variant) {
    return {
      productId: item.productId,
      variantId: item.variantId,
      qty: item.qty,
      slug: product?.slug ?? null,
      productName: product?.name ?? 'Unavailable item',
      brandName: product?.brandName ?? '',
      variantLabel: '',
      sku: null,
      unit: product?.unit ?? null,
      imageKey: product?.imageKey ?? null,
      mrp: 0,
      basePrice: 0,
      unitPrice: 0,
      appliedTierMinQty: null,
      lineTotal: 0,
      savings: 0,
      nextTier: null,
      stock: 0,
      issue,
    };
  }

  const { unitPrice, appliedTierMinQty } = getUnitPrice(variant, item.qty);
  return {
    productId: item.productId,
    variantId: item.variantId,
    qty: item.qty,
    slug: product.slug,
    productName: product.name,
    brandName: product.brandName,
    variantLabel: variant.label,
    sku: variant.sku,
    unit: product.unit,
    imageKey: product.imageKey,
    mrp: variant.mrp,
    basePrice: variant.price,
    unitPrice,
    appliedTierMinQty,
    lineTotal: lineTotal(unitPrice, item.qty),
    savings: lineSavings(variant.mrp, unitPrice, item.qty),
    nextTier: nextTier(variant, item.qty),
    stock: Math.max(0, variant.stock),
    issue,
  };
}

/** A line counts toward totals unless the item can't be bought at all. */
function countsTowardTotal(line: PricedCartLine): boolean {
  return line.issue?.code !== 'PRODUCT_UNAVAILABLE' && line.issue?.code !== 'OUT_OF_STOCK';
}

/**
 * Prices a cart. `lines` pair each cart item with its current product data (null when the product
 * is gone). `area` is the chosen delivery area (null → no estimate yet).
 *
 * Unavailable and out-of-stock lines are listed with their issue but left out of the totals;
 * any line issue, an unserviceable area or an empty cart blocks checkout.
 */
export function computeCart(
  lines: readonly { item: CartItem; product: CartProductData | null }[],
  area: CartDeliveryArea | null,
  settings: DeliverySettings,
): PricedCart {
  const priced = lines.map(({ item, product }) => priceLine(item, product));
  const counted = priced.filter(countsTowardTotal);

  const subtotal = counted.reduce((sum, line) => sum + line.lineTotal, 0);
  const savings = counted.reduce((sum, line) => sum + line.savings, 0);
  const itemCount = counted.reduce((sum, line) => sum + line.qty, 0);

  const issues: CartIssue[] = priced
    .filter((line) => line.issue !== null)
    .map((line) => ({
      code: line.issue?.code ?? 'PRODUCT_UNAVAILABLE',
      message: line.issue?.message ?? '',
      variantId: line.variantId,
    }));

  if (priced.length === 0) {
    issues.push({ code: 'EMPTY_CART', message: 'Your cart is empty.' });
  }

  let deliveryFee: number | null = null;
  let amountToFreeDelivery: number | null = null;
  if (area && !area.isServiceable) {
    issues.push({ code: 'AREA_NOT_SERVICEABLE', message: notServiceableMessage(area.name) });
  } else if (area && counted.length > 0) {
    const result = getDeliveryFee(subtotal, area, settings);
    deliveryFee = result.fee;
    amountToFreeDelivery = result.amountToFreeDelivery;
  }

  return {
    lines: priced,
    itemCount,
    subtotal,
    savings,
    deliveryFee,
    total: subtotal + (deliveryFee ?? 0),
    amountToFreeDelivery,
    area: area
      ? {
          id: area.id,
          name: area.name,
          isServiceable: area.isServiceable,
          freeDeliveryAbove: area.freeDeliveryAbove,
        }
      : null,
    issues,
    canCheckout: issues.length === 0 && area !== null && deliveryFee !== null,
  };
}

/**
 * Merges a guest cart into a stored cart (SPEC §6.3): same variant → quantities added, capped at
 * `maxQtyFor(variantId)` (current stock) and 9,999. Lines keep their first-seen order.
 */
export function mergeCartItems(
  stored: readonly CartItem[],
  incoming: readonly CartItem[],
  maxQtyFor: (variantId: string) => number,
): CartItem[] {
  const merged = new Map<string, CartItem>();
  for (const item of [...stored, ...incoming]) {
    const existing = merged.get(item.variantId);
    const qty = (existing?.qty ?? 0) + item.qty;
    merged.set(item.variantId, { productId: item.productId, variantId: item.variantId, qty });
  }
  return [...merged.values()]
    .map((item) => ({
      ...item,
      qty: Math.min(item.qty, QTY_MAX, Math.max(maxQtyFor(item.variantId), 0)),
    }))
    .filter((item) => item.qty > 0);
}
