import type { PricedCart } from '@aricon/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStaff, ORIGIN } from './utils/auth.js';
import {
  createArea,
  createCatalogBasics,
  createProduct,
  customerAgent,
  type CatalogBasics,
  type CreatedProduct,
} from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** Carts (SPEC §6.2–6.4, §7.2 "Cart"): guest quotes, the stored cart and the merge after login. */
describe('Cart', () => {
  let testApp: TestApp;
  let server: Parameters<typeof request>[0];
  let basics: CatalogBasics;
  let cement: CreatedProduct; // price 425, tiers 10+/415, 30+/405, 50+/395; stock 60
  let soldOut: CreatedProduct;
  let hidden: CreatedProduct;
  let dha: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as Parameters<typeof request>[0];
    basics = await createCatalogBasics(testApp.app);
    cement = await createProduct(testApp.app, basics, {
      variants: [
        {
          price: 425,
          mrp: 450,
          stock: 60,
          bulkTiers: [
            { minQty: 10, price: 415 },
            { minQty: 30, price: 405 },
            { minQty: 50, price: 395 },
          ],
        },
        { price: 300, stock: 8 },
      ],
    });
    soldOut = await createProduct(testApp.app, basics, { variants: [{ price: 100, stock: 0 }] });
    hidden = await createProduct(testApp.app, basics, { status: 'hidden', variants: [{ price: 100, stock: 10 }] });
    dha = await createArea(testApp.app, { name: 'DHA', deliveryFee: 300, freeDeliveryAbove: 20_000 });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const line = (product: CreatedProduct, qty: number, variant = 0) => ({
    productId: product.id,
    variantId: product.variantIds[variant] as string,
    qty,
  });

  const quote = (body: object) => request(server).post('/api/cart/quote').set('Origin', ORIGIN).send(body);

  describe('POST /api/cart/quote (guests)', () => {
    it('prices lines with bulk tiers and the delivery estimate', async () => {
      const { body } = await quote({ items: [line(cement, 49)], areaId: dha }).expect(200);
      const cart = body.data as PricedCart;
      expect(cart.lines[0]).toMatchObject({ qty: 49, basePrice: 425, unitPrice: 405, appliedTierMinQty: 30, lineTotal: 19_845 });
      expect(cart.lines[0]?.nextTier).toEqual({ minQty: 50, price: 395, qtyNeeded: 1 });
      expect(cart).toMatchObject({ subtotal: 19_845, deliveryFee: 300, total: 20_145, amountToFreeDelivery: 155, canCheckout: true });
    });

    it('free delivery above the threshold; no estimate for an unknown area', async () => {
      const free = (await quote({ items: [line(cement, 50)], areaId: dha }).expect(200)).body.data as PricedCart;
      expect(free).toMatchObject({ subtotal: 19_750, deliveryFee: 300 });
      const over = (await quote({ items: [line(cement, 51)], areaId: dha }).expect(200)).body.data as PricedCart;
      expect(over).toMatchObject({ subtotal: 20_145, deliveryFee: 0, amountToFreeDelivery: 0 });

      const unknown = (await quote({ items: [line(cement, 1)], areaId: '0123456789abcdef01234567' }).expect(200)).body
        .data as PricedCart;
      expect(unknown).toMatchObject({ area: null, deliveryFee: null, canCheckout: false });
    });

    it('reports unavailable, sold-out and over-stock lines and leaves the first two out of the total', async () => {
      const cart = (
        await quote({ items: [line(hidden, 1), line(soldOut, 1), line(cement, 9, 1)], areaId: dha }).expect(200)
      ).body.data as PricedCart;
      expect(cart.lines.map((item) => item.issue?.code)).toEqual(['PRODUCT_UNAVAILABLE', 'OUT_OF_STOCK', 'QTY_EXCEEDS_STOCK']);
      expect(cart.lines[2]?.issue?.maxQty).toBe(8);
      expect(cart.subtotal).toBe(2_700);
      expect(cart.canCheckout).toBe(false);
    });

    it('combines repeated variants and ignores a variant sent with the wrong product', async () => {
      const cart = (await quote({ items: [line(cement, 4), line(cement, 6)] }).expect(200)).body.data as PricedCart;
      expect(cart.lines).toHaveLength(1);
      expect(cart.lines[0]).toMatchObject({ qty: 10, unitPrice: 415 });

      const mismatched = (
        await quote({ items: [{ productId: soldOut.id, variantId: cement.variantIds[0], qty: 1 }] }).expect(200)
      ).body.data as PricedCart;
      expect(mismatched.lines[0]?.issue?.code).toBe('PRODUCT_UNAVAILABLE');
    });

    it('validates every line', async () => {
      const { body } = await quote({ items: [{ productId: 'nope', variantId: cement.variantIds[0], qty: 0 }] }).expect(400);
      expect(body.error.details.map((issue: { path: string }) => issue.path).sort()).toEqual([
        'items.0.productId',
        'items.0.qty',
      ]);
    });
  });

  describe('stored cart (customers)', () => {
    it('needs a customer session; a staff session is not one', async () => {
      await request(server).get('/api/cart').expect(401);

      const staff = await createStaff(testApp.app, { role: 'ADMIN' });
      const agent = request.agent(server);
      await agent
        .post('/api/admin/auth/login')
        .set('Origin', ORIGIN)
        .send({ email: staff.email, password: staff.password })
        .expect(200);
      await agent.get('/api/cart').expect(401);
    });

    it('adds, updates and removes lines', async () => {
      const { agent } = await customerAgent(testApp.app);
      const put = (variantId: string | undefined, qty: number) =>
        agent.put(`/api/cart/items?areaId=${dha}`).set('Origin', ORIGIN).send({ variantId, qty });

      let cart = (await put(cement.variantIds[0], 10).expect(200)).body.data as PricedCart;
      expect(cart.lines).toHaveLength(1);
      expect(cart).toMatchObject({ subtotal: 4_150, deliveryFee: 300 });

      cart = (await put(cement.variantIds[1], 20).expect(200)).body.data as PricedCart;
      expect(cart.lines[1]?.issue).toMatchObject({ code: 'QTY_EXCEEDS_STOCK', maxQty: 8 });

      cart = (await put(cement.variantIds[0], 0).expect(200)).body.data as PricedCart;
      expect(cart.lines.map((item) => item.variantId)).toEqual([cement.variantIds[1]]);

      cart = (await agent.delete(`/api/cart/items/${cement.variantIds[1]}`).set('Origin', ORIGIN).expect(200)).body
        .data as PricedCart;
      expect(cart.lines).toEqual([]);
      expect(cart.issues).toEqual([{ code: 'EMPTY_CART', message: 'Your cart is empty.' }]);

      expect(((await agent.get('/api/cart').expect(200)).body.data as PricedCart).lines).toEqual([]);
    });

    it('refuses items that are not on sale or sold out', async () => {
      const { agent } = await customerAgent(testApp.app);
      const put = (variantId: string | undefined) =>
        agent.put('/api/cart/items').set('Origin', ORIGIN).send({ variantId, qty: 1 });

      expect((await put(hidden.variantIds[0]).expect(404)).body.error.code).toBe('NOT_FOUND');
      expect((await put('0123456789abcdef01234567').expect(404)).body.error.code).toBe('NOT_FOUND');
      expect((await put(soldOut.variantIds[0]).expect(409)).body.error.code).toBe('OUT_OF_STOCK');
    });

    it('merges a guest cart: same variant adds up, capped at stock; unavailable lines are dropped', async () => {
      const { agent } = await customerAgent(testApp.app);
      await agent.put('/api/cart/items').set('Origin', ORIGIN).send({ variantId: cement.variantIds[1], qty: 5 }).expect(200);

      const cart = (
        await agent
          .post('/api/cart/merge')
          .set('Origin', ORIGIN)
          .send({ items: [line(cement, 6, 1), line(cement, 12), line(soldOut, 1), line(hidden, 2)] })
          .expect(200)
      ).body.data as PricedCart;

      expect(cart.lines.map((item) => [item.variantId, item.qty])).toEqual([
        [cement.variantIds[1], 8],
        [cement.variantIds[0], 12],
      ]);
      expect(cart.issues).toEqual([]);
    });

    it('rejects writes from another site', async () => {
      const { agent } = await customerAgent(testApp.app);
      await agent
        .put('/api/cart/items')
        .set('Origin', 'https://evil.example')
        .send({ variantId: cement.variantIds[0], qty: 1 })
        .expect(403);
    });
  });
});
