import { describe, expect, it } from 'vitest';
import {
  computeCart,
  mergeCartItems,
  type CartDeliveryArea,
  type CartItem,
  type CartProductData,
} from './cart.js';

type VariantData = NonNullable<CartProductData['variant']>;

const settings = { defaultDeliveryFee: 500 };

const gulshan: CartDeliveryArea = {
  id: 'area-gulshan',
  name: 'Gulshan-e-Iqbal',
  isServiceable: true,
  deliveryFee: 300,
  freeDeliveryAbove: 50_000,
};

/** OPC cement: price 425, MRP 440, tiers 10 → 415, 30 → 405, 50 → 395 (SPEC §6.1). */
function product(overrides: Partial<CartProductData> = {}, variant: Partial<VariantData> = {}): CartProductData {
  return {
    productId: 'p-cement',
    slug: 'opc-cement',
    name: 'OPC Cement',
    brandName: 'Lucky',
    unit: 'bag',
    status: 'active',
    imageKey: 'products/p/i',
    variant: {
      id: 'v-cement',
      sku: 'LUCKY-OPC-50',
      label: '50 kg bag',
      mrp: 440,
      price: 425,
      bulkTiers: [
        { minQty: 10, price: 415 },
        { minQty: 30, price: 405 },
        { minQty: 50, price: 395 },
      ],
      stock: 500,
      isActive: true,
      ...variant,
    },
    ...overrides,
  };
}

/** A plain 500-rupee item without tiers, to hit exact subtotals. */
function plain(id: string, variant: Partial<VariantData> = {}, overrides: Partial<CartProductData> = {}): CartProductData {
  return product(
    { productId: `p-${id}`, slug: id, name: id, ...overrides },
    { id: `v-${id}`, sku: id.toUpperCase(), mrp: 500, price: 500, bulkTiers: [], ...variant },
  );
}

function line(data: CartProductData | null, qty: number, ids?: { productId: string; variantId: string }) {
  const productId = ids?.productId ?? data?.productId ?? 'p-missing';
  const variantId = ids?.variantId ?? data?.variant?.id ?? 'v-missing';
  return { item: { productId, variantId, qty }, product: data };
}

describe('computeCart pricing (SPEC §6.2)', () => {
  it('prices each line with the applied tier, savings and next-tier nudge', () => {
    const cart = computeCart([line(product(), 12)], gulshan, settings);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({
      productId: 'p-cement',
      variantId: 'v-cement',
      qty: 12,
      slug: 'opc-cement',
      productName: 'OPC Cement',
      brandName: 'Lucky',
      variantLabel: '50 kg bag',
      sku: 'LUCKY-OPC-50',
      unit: 'bag',
      mrp: 440,
      basePrice: 425,
      unitPrice: 415,
      appliedTierMinQty: 10,
      lineTotal: 4980,
      savings: 300,
      nextTier: { minQty: 30, price: 405, qtyNeeded: 18 },
      stock: 500,
      issue: null,
    });
  });

  it('sums subtotal, savings and item count, and adds the area fee to the total', () => {
    const cart = computeCart([line(product(), 12), line(plain('tile'), 3)], gulshan, settings);
    expect(cart.subtotal).toBe(4980 + 1500);
    expect(cart.savings).toBe(300);
    expect(cart.itemCount).toBe(15);
    expect(cart.deliveryFee).toBe(300);
    expect(cart.total).toBe(6480 + 300);
    expect(cart.amountToFreeDelivery).toBe(50_000 - 6480);
    expect(cart.issues).toEqual([]);
    expect(cart.canCheckout).toBe(true);
    expect(cart.area).toEqual({
      id: 'area-gulshan',
      name: 'Gulshan-e-Iqbal',
      isServiceable: true,
      freeDeliveryAbove: 50_000,
    });
  });

  it('keeps every amount a whole number of rupees', () => {
    const cart = computeCart([line(product(), 37), line(plain('tile'), 7)], gulshan, settings);
    for (const value of [cart.subtotal, cart.total, cart.savings, cart.deliveryFee ?? 0]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('computeCart delivery', () => {
  it('makes delivery free when the subtotal is exactly the threshold', () => {
    const cart = computeCart([line(plain('tile'), 100)], gulshan, settings);
    expect(cart.subtotal).toBe(50_000);
    expect(cart.deliveryFee).toBe(0);
    expect(cart.amountToFreeDelivery).toBe(0);
    expect(cart.total).toBe(50_000);
  });

  it('charges the fee one rupee below the threshold', () => {
    const cart = computeCart([line(plain('tile', { price: 49_999, mrp: 49_999 }), 1)], gulshan, settings);
    expect(cart.deliveryFee).toBe(300);
    expect(cart.amountToFreeDelivery).toBe(1);
    expect(cart.total).toBe(50_299);
  });

  it('uses the default fee when the area has none', () => {
    const cart = computeCart([line(plain('tile'), 1)], { ...gulshan, deliveryFee: null }, settings);
    expect(cart.deliveryFee).toBe(500);
    expect(cart.total).toBe(1000);
  });

  it('has no free-delivery amount when the area has no threshold', () => {
    const cart = computeCart([line(plain('tile'), 200)], { ...gulshan, freeDeliveryAbove: null }, settings);
    expect(cart.deliveryFee).toBe(300);
    expect(cart.amountToFreeDelivery).toBeNull();
  });

  it('gives no estimate without an area and cannot check out', () => {
    const cart = computeCart([line(product(), 12)], null, settings);
    expect(cart.deliveryFee).toBeNull();
    expect(cart.amountToFreeDelivery).toBeNull();
    expect(cart.total).toBe(cart.subtotal);
    expect(cart.area).toBeNull();
    expect(cart.issues).toEqual([]);
    expect(cart.canCheckout).toBe(false);
  });

  it('flags an unserviceable area and blocks checkout', () => {
    const malir = { ...gulshan, id: 'area-malir', name: 'Malir', isServiceable: false };
    const cart = computeCart([line(product(), 12)], malir, settings);
    expect(cart.issues).toEqual([{ code: 'AREA_NOT_SERVICEABLE', message: "We don't deliver to Malir yet." }]);
    expect(cart.deliveryFee).toBeNull();
    expect(cart.total).toBe(cart.subtotal);
    expect(cart.area?.isServiceable).toBe(false);
    expect(cart.canCheckout).toBe(false);
  });
});

describe('computeCart line issues', () => {
  it.each([
    ['a hidden product', product({ status: 'hidden' })],
    ['an archived product', product({ status: 'archived' })],
    ['an inactive variant', product({}, { isActive: false })],
    ['a variant that no longer exists', product({ variant: null })],
  ])('marks %s PRODUCT_UNAVAILABLE and leaves it out of the totals', (_label, data) => {
    const cart = computeCart([line(data, 12, { productId: 'p-cement', variantId: 'v-cement' })], gulshan, settings);
    expect(cart.lines[0]?.issue?.code).toBe('PRODUCT_UNAVAILABLE');
    expect(cart.issues).toEqual([
      { code: 'PRODUCT_UNAVAILABLE', message: expect.any(String), variantId: 'v-cement' },
    ]);
    expect(cart.subtotal).toBe(0);
    expect(cart.itemCount).toBe(0);
    expect(cart.savings).toBe(0);
    expect(cart.canCheckout).toBe(false);
  });

  it('marks a product that no longer exists PRODUCT_UNAVAILABLE and keeps the cart ids', () => {
    const cart = computeCart([line(null, 4, { productId: 'p-gone', variantId: 'v-gone' })], gulshan, settings);
    expect(cart.lines[0]).toMatchObject({
      productId: 'p-gone',
      variantId: 'v-gone',
      qty: 4,
      lineTotal: 0,
      issue: { code: 'PRODUCT_UNAVAILABLE' },
    });
    expect(cart.subtotal).toBe(0);
    expect(cart.canCheckout).toBe(false);
  });

  it('prefers PRODUCT_UNAVAILABLE over OUT_OF_STOCK for a hidden product without stock', () => {
    const cart = computeCart([line(product({ status: 'hidden' }, { stock: 0 }), 1)], gulshan, settings);
    expect(cart.lines[0]?.issue?.code).toBe('PRODUCT_UNAVAILABLE');
  });

  it('marks stock 0 (or a negative count) OUT_OF_STOCK and leaves it out of the totals', () => {
    for (const stock of [0, -3]) {
      const cart = computeCart([line(product({}, { stock }), 2)], gulshan, settings);
      expect(cart.lines[0]?.issue?.code).toBe('OUT_OF_STOCK');
      expect(cart.lines[0]?.stock).toBe(0);
      expect(cart.subtotal).toBe(0);
      expect(cart.itemCount).toBe(0);
      expect(cart.issues.map((i) => i.code)).toEqual(['OUT_OF_STOCK']);
      expect(cart.canCheckout).toBe(false);
    }
  });

  it('marks qty above stock QTY_EXCEEDS_STOCK and offers the stock as maxQty', () => {
    const cart = computeCart([line(product({}, { stock: 6 }), 12)], gulshan, settings);
    expect(cart.lines[0]?.issue).toEqual({
      code: 'QTY_EXCEEDS_STOCK',
      message: expect.stringContaining('6'),
      maxQty: 6,
    });
    expect(cart.issues).toEqual([{ code: 'QTY_EXCEEDS_STOCK', message: expect.any(String), variantId: 'v-cement' }]);
    expect(cart.canCheckout).toBe(false);
  });

  it('caps maxQty at 9,999 even when stock is larger', () => {
    // qty above 9,999 never passes the request schema; this guards the suggestion itself.
    const cart = computeCart([line(product({}, { stock: 20_000 }), 25_000)], gulshan, settings);
    expect(cart.lines[0]?.issue?.maxQty).toBe(9999);
  });

  it('accepts qty equal to stock', () => {
    const cart = computeCart([line(product({}, { stock: 12 }), 12)], gulshan, settings);
    expect(cart.lines[0]?.issue).toBeNull();
    expect(cart.canCheckout).toBe(true);
  });

  it('still prices a line whose qty exceeds stock so the UI can show it', () => {
    const cart = computeCart([line(product({}, { stock: 6 }), 12)], gulshan, settings);
    expect(cart.lines[0]?.lineTotal).toBe(4980);
    expect(cart.subtotal).toBe(4980);
  });

  it('keeps unavailable lines from pushing the subtotal over the free-delivery threshold', () => {
    const cart = computeCart(
      [
        line(plain('tile'), 10),
        line(plain('hidden-slab', { price: 60_000, mrp: 60_000 }, { status: 'hidden' }), 1),
        line(plain('empty-shelf', { price: 60_000, mrp: 60_000, stock: 0 }), 1),
      ],
      gulshan,
      settings,
    );
    expect(cart.subtotal).toBe(5000);
    expect(cart.itemCount).toBe(10);
    expect(cart.deliveryFee).toBe(300);
    expect(cart.amountToFreeDelivery).toBe(45_000);
    expect(cart.issues).toEqual([
      { code: 'PRODUCT_UNAVAILABLE', message: expect.any(String), variantId: 'v-hidden-slab' },
      { code: 'OUT_OF_STOCK', message: expect.any(String), variantId: 'v-empty-shelf' },
    ]);
    expect(cart.lines).toHaveLength(3);
    expect(cart.canCheckout).toBe(false);
  });

  it('gives no delivery fee when nothing in the cart can be bought', () => {
    const cart = computeCart([line(product({ status: 'hidden' }), 2)], gulshan, settings);
    expect(cart.deliveryFee).toBeNull();
    expect(cart.total).toBe(0);
  });
});

describe('computeCart empty cart', () => {
  it('reports EMPTY_CART and cannot check out', () => {
    const cart = computeCart([], gulshan, settings);
    expect(cart.lines).toEqual([]);
    expect(cart.issues).toEqual([{ code: 'EMPTY_CART', message: 'Your cart is empty.' }]);
    expect(cart.subtotal).toBe(0);
    expect(cart.itemCount).toBe(0);
    expect(cart.total).toBe(0);
    expect(cart.deliveryFee).toBeNull();
    expect(cart.canCheckout).toBe(false);
  });
});

describe('mergeCartItems (SPEC §6.3)', () => {
  const plenty = () => 10_000;

  it('adds quantities of the same variant', () => {
    expect(
      mergeCartItems([{ productId: 'p1', variantId: 'v1', qty: 3 }], [{ productId: 'p1', variantId: 'v1', qty: 4 }], plenty),
    ).toEqual([{ productId: 'p1', variantId: 'v1', qty: 7 }]);
  });

  it('keeps different variants, stored lines first', () => {
    const merged = mergeCartItems(
      [
        { productId: 'p1', variantId: 'v1', qty: 1 },
        { productId: 'p2', variantId: 'v2', qty: 2 },
      ],
      [
        { productId: 'p3', variantId: 'v3', qty: 3 },
        { productId: 'p1', variantId: 'v1', qty: 1 },
      ],
      plenty,
    );
    expect(merged).toEqual([
      { productId: 'p1', variantId: 'v1', qty: 2 },
      { productId: 'p2', variantId: 'v2', qty: 2 },
      { productId: 'p3', variantId: 'v3', qty: 3 },
    ]);
  });

  it('treats two variants of one product as separate lines', () => {
    const merged = mergeCartItems(
      [{ productId: 'p1', variantId: 'v1', qty: 1 }],
      [{ productId: 'p1', variantId: 'v1b', qty: 1 }],
      plenty,
    );
    expect(merged).toHaveLength(2);
  });

  it('caps the merged quantity at the current stock', () => {
    const stock: Record<string, number> = { v1: 5 };
    expect(
      mergeCartItems(
        [{ productId: 'p1', variantId: 'v1', qty: 3 }],
        [{ productId: 'p1', variantId: 'v1', qty: 4 }],
        (id) => stock[id] ?? 0,
      ),
    ).toEqual([{ productId: 'p1', variantId: 'v1', qty: 5 }]);
  });

  it('caps the merged quantity at 9,999', () => {
    expect(
      mergeCartItems(
        [{ productId: 'p1', variantId: 'v1', qty: 9000 }],
        [{ productId: 'p1', variantId: 'v1', qty: 2000 }],
        () => 50_000,
      ),
    ).toEqual([{ productId: 'p1', variantId: 'v1', qty: 9999 }]);
  });

  it('drops lines with no stock (or unknown variants)', () => {
    const stock: Record<string, number> = { v1: 0, v2: -2, v3: 4 };
    expect(
      mergeCartItems(
        [{ productId: 'p1', variantId: 'v1', qty: 3 }],
        [
          { productId: 'p2', variantId: 'v2', qty: 1 },
          { productId: 'p3', variantId: 'v3', qty: 1 },
          { productId: 'p4', variantId: 'v4', qty: 1 },
        ],
        (id) => stock[id] ?? 0,
      ),
    ).toEqual([{ productId: 'p3', variantId: 'v3', qty: 1 }]);
  });

  it('merges duplicate lines inside one list', () => {
    expect(
      mergeCartItems(
        [],
        [
          { productId: 'p1', variantId: 'v1', qty: 2 },
          { productId: 'p1', variantId: 'v1', qty: 2 },
        ],
        plenty,
      ),
    ).toEqual([{ productId: 'p1', variantId: 'v1', qty: 4 }]);
  });

  it('returns an empty cart for empty input and leaves the inputs untouched', () => {
    expect(mergeCartItems([], [], plenty)).toEqual([]);
    const stored: CartItem[] = [{ productId: 'p1', variantId: 'v1', qty: 3 }];
    const incoming: CartItem[] = [{ productId: 'p1', variantId: 'v1', qty: 4 }];
    mergeCartItems(stored, incoming, () => 5);
    expect(stored).toEqual([{ productId: 'p1', variantId: 'v1', qty: 3 }]);
    expect(incoming).toEqual([{ productId: 'p1', variantId: 'v1', qty: 4 }]);
  });
});
