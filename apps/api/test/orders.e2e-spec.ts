import { IDEMPOTENCY_HEADER, karachiYear, ORDER_NUMBER_PATTERN, type CustomerOrderDTO, type PricedCart } from '@aricon/shared';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Cart } from '../src/models/cart.model.js';
import { DeliveryArea } from '../src/models/delivery-area.model.js';
import { Order } from '../src/models/order.model.js';
import { Product } from '../src/models/product.model.js';
import { Settings, SETTINGS_ID } from '../src/models/settings.model.js';
import { StockMovement } from '../src/models/stock-movement.model.js';
import { ORIGIN } from './utils/auth.js';
import {
  createArea,
  createCatalogBasics,
  createProduct,
  customerAgent,
  modelOf,
  type Agent,
  type CatalogBasics,
  type CreatedProduct,
} from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** Order placement and customer order actions (SPEC §6.6–6.9, §7.2, Phase 2a MUST tests). */
describe('Orders', () => {
  let testApp: TestApp;
  let basics: CatalogBasics;
  let areaId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    basics = await createCatalogBasics(testApp.app);
    areaId = await createArea(testApp.app, { name: 'Gulshan-e-Iqbal', deliveryFee: 500 });
    await modelOf<Settings>(testApp.app, Settings.name).create({
      _id: SETTINGS_ID,
      codMaxOrderAmount: 100_000,
      orderNotificationEmails: ['orders@aricon.test'],
    });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const products = () => modelOf<Product>(testApp.app, Product.name);
  const orders = () => modelOf<Order>(testApp.app, Order.name);
  const movements = () => modelOf<StockMovement>(testApp.app, StockMovement.name);

  async function stockOf(product: CreatedProduct, variant = 0): Promise<number> {
    const doc = await products().findById(product.id).lean().exec();
    return doc?.variants.find((item) => String(item._id) === product.variantIds[variant])?.stock ?? -1;
  }

  /** A customer with a saved address and these items in their cart. */
  async function shopper(lines: { product: CreatedProduct; qty: number; variant?: number }[]) {
    const { agent, userId } = await customerAgent(testApp.app);
    const [address] = (
      await agent
        .post('/api/account/addresses')
        .set('Origin', ORIGIN)
        .send({ label: 'Site', contactName: 'Ahmed Raza', phone: '03001234567', line1: 'Plot 12, Block 5', areaId })
        .expect(201)
    ).body.data as { id: string }[];
    for (const line of lines) {
      await agent
        .put('/api/cart/items')
        .set('Origin', ORIGIN)
        .send({ variantId: line.product.variantIds[line.variant ?? 0], qty: line.qty })
        .expect(200);
    }
    const cart = (await agent.get(`/api/cart?areaId=${areaId}`).expect(200)).body.data as PricedCart;
    return { agent, userId, addressId: address?.id as string, cart };
  }

  function place(
    agent: Agent,
    body: { addressId: string; expectedTotal: number; paymentMethod?: string; customerNote?: string },
    key: string = randomUUID(),
  ) {
    return agent
      .post('/api/orders')
      .set('Origin', ORIGIN)
      .set(IDEMPOTENCY_HEADER, key)
      .send({ paymentMethod: 'COD', ...body });
  }

  describe('placing an order', () => {
    it('happy path: snapshots, stock taken, movements written, cart emptied, number format', async () => {
      const cement = await createProduct(testApp.app, basics, {
        name: 'Lucky OPC Cement',
        variants: [{ price: 425, mrp: 450, stock: 100, bulkTiers: [{ minQty: 10, price: 415 }], label: '50 kg bag' }],
      });
      const { agent, addressId, cart } = await shopper([{ product: cement, qty: 12 }]);
      expect(cart.total).toBe(12 * 415 + 500);

      const res = await place(agent, { addressId, expectedTotal: cart.total, customerNote: 'Call at the gate.' }).expect(201);
      const order = res.body.data as CustomerOrderDTO;
      expect(order.orderNumber).toMatch(ORDER_NUMBER_PATTERN);
      expect(order.orderNumber.startsWith(`ARC-${karachiYear(new Date())}-`)).toBe(true);
      expect(order).toMatchObject({
        status: 'NEW',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        subtotal: 4_980,
        deliveryFee: 500,
        total: 5_480,
        customerNote: 'Call at the gate.',
        canCancel: true,
        canUploadReceipt: false,
        rider: null,
      });
      expect(order.items[0]).toMatchObject({
        productName: 'Lucky OPC Cement',
        variantLabel: '50 kg bag',
        qty: 12,
        basePrice: 425,
        unitPrice: 415,
        appliedTierMinQty: 10,
        lineTotal: 4_980,
        productSlug: cement.slug,
      });
      expect(order.shippingAddress).toMatchObject({ areaName: 'Gulshan-e-Iqbal', phone: '+923001234567', city: 'Karachi' });
      expect(order.statusHistory).toEqual([{ status: 'NEW', at: expect.any(String), byType: 'customer', note: null }]);

      expect(await stockOf(cement)).toBe(88);
      const product = await products().findById(cement.id).lean().exec();
      expect(product?.totalStock).toBe(88);
      const moves = await movements().find({ variantId: new Types.ObjectId(cement.variantIds[0]) }).lean().exec();
      expect(moves).toEqual([
        expect.objectContaining({ change: -12, stockAfter: 88, reason: 'ORDER', refType: 'order', refId: new Types.ObjectId(order.id) }),
      ]);
      expect(((await agent.get('/api/cart').expect(200)).body.data as PricedCart).lines).toEqual([]);

      // It shows up in the customer's list and detail.
      const list = await agent.get('/api/orders').expect(200);
      expect(list.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
      expect(list.body.data[0]).toMatchObject({ orderNumber: order.orderNumber, itemCount: 12, total: 5_480 });
      expect((await agent.get(`/api/orders/${order.orderNumber}`).expect(200)).body.data.id).toBe(order.id);
    });

    it('numbers orders one after another', async () => {
      const tiles = await createProduct(testApp.app, basics, { variants: [{ price: 1_000, stock: 50 }] });
      const numbers: number[] = [];
      for (let i = 0; i < 2; i += 1) {
        const { agent, addressId, cart } = await shopper([{ product: tiles, qty: 1 }]);
        const order = (await place(agent, { addressId, expectedTotal: cart.total }).expect(201)).body.data as CustomerOrderDTO;
        numbers.push(Number(order.orderNumber.split('-')[2]));
      }
      expect(numbers[1]).toBe((numbers[0] as number) + 1);
    });

    it('idempotency: the same key returns the same order, also when sent twice at once', async () => {
      const sand = await createProduct(testApp.app, basics, { variants: [{ price: 2_000, stock: 30 }] });
      const { agent, addressId, cart, userId } = await shopper([{ product: sand, qty: 2 }]);
      const key = randomUUID();

      const [first, second] = await Promise.all([
        place(agent, { addressId, expectedTotal: cart.total }, key),
        place(agent, { addressId, expectedTotal: cart.total }, key),
      ]);
      expect([first.status, second.status].sort((x, y) => x - y)).toEqual([200, 201]);
      expect(first.body.data.orderNumber).toBe(second.body.data.orderNumber);

      const again = await place(agent, { addressId, expectedTotal: cart.total }, key).expect(200);
      expect(again.body.data.orderNumber).toBe(first.body.data.orderNumber);

      expect(await orders().countDocuments({ userId: new Types.ObjectId(userId) })).toBe(1);
      expect(await stockOf(sand)).toBe(28);
    });

    it('concurrency: two orders for the last 5 units — exactly one succeeds, no overselling', async () => {
      const lastFive = await createProduct(testApp.app, basics, { variants: [{ price: 700, stock: 5 }] });
      const a = await shopper([{ product: lastFive, qty: 5 }]);
      const b = await shopper([{ product: lastFive, qty: 5 }]);

      const results = await Promise.all([
        place(a.agent, { addressId: a.addressId, expectedTotal: a.cart.total }),
        place(b.agent, { addressId: b.addressId, expectedTotal: b.cart.total }),
      ]);
      expect(results.map((res) => res.status).sort((x, y) => x - y)).toEqual([201, 409]);
      const refused = results.find((res) => res.status === 409);
      expect(refused?.body.error.code).toBe('OUT_OF_STOCK');
      expect(refused?.body.error.details.cart.lines[0].issue.code).toBe('OUT_OF_STOCK');

      expect(await stockOf(lastFive)).toBe(0);
      expect(await movements().countDocuments({ variantId: new Types.ObjectId(lastFive.variantIds[0]) })).toBe(1);
    });

    it('PRICE_CHANGED when the total differs from what the customer saw', async () => {
      const paint = await createProduct(testApp.app, basics, { variants: [{ price: 3_000, stock: 10 }] });
      const { agent, addressId, cart } = await shopper([{ product: paint, qty: 1 }]);
      await products()
        .updateOne({ _id: new Types.ObjectId(paint.id) }, { $set: { 'variants.0.price': 3_200, 'variants.0.mrp': 3_200 } })
        .exec();

      const res = await place(agent, { addressId, expectedTotal: cart.total }).expect(409);
      expect(res.body.error.code).toBe('PRICE_CHANGED');
      expect(res.body.error.details.cart.total).toBe(3_700);
      expect(await stockOf(paint)).toBe(10);
      expect(((await agent.get('/api/cart').expect(200)).body.data as PricedCart).lines).toHaveLength(1);
    });

    it('OUT_OF_STOCK when the cart asks for more than is left', async () => {
      const pipe = await createProduct(testApp.app, basics, { variants: [{ price: 300, stock: 10 }] });
      const { agent, addressId, cart } = await shopper([{ product: pipe, qty: 8 }]);
      await products().updateOne({ _id: new Types.ObjectId(pipe.id) }, { $set: { 'variants.0.stock': 3 } }).exec();

      const res = await place(agent, { addressId, expectedTotal: cart.total }).expect(409);
      expect(res.body.error.code).toBe('OUT_OF_STOCK');
      expect(res.body.error.details.cart.lines[0].issue).toMatchObject({ code: 'QTY_EXCEEDS_STOCK', maxQty: 3 });
      expect(await stockOf(pipe)).toBe(3);
    });

    it('checks the address, the area, the payment method and the header', async () => {
      const wire = await createProduct(testApp.app, basics, { variants: [{ price: 60_000, stock: 10 }] });
      const { agent, addressId, cart } = await shopper([{ product: wire, qty: 2 }]);

      // COD is limited to 100,000 in this store.
      const cod = await place(agent, { addressId, expectedTotal: cart.total }).expect(400);
      expect(cod.body.error.details).toEqual([
        { path: 'paymentMethod', message: 'Cash on delivery is available for orders up to Rs 100,000.' },
      ]);

      const stranger = await customerAgent(testApp.app);
      await place(stranger.agent, { addressId, expectedTotal: cart.total }).expect(400);

      const missingKey = await agent
        .post('/api/orders')
        .set('Origin', ORIGIN)
        .send({ addressId, paymentMethod: 'BANK_TRANSFER', expectedTotal: cart.total })
        .expect(400);
      expect(missingKey.body.error.details[0].path).toBe(IDEMPOTENCY_HEADER);

      const bank = await place(agent, { addressId, expectedTotal: cart.total, paymentMethod: 'BANK_TRANSFER' }).expect(201);
      expect(bank.body.data).toMatchObject({ paymentMethod: 'BANK_TRANSFER', paymentStatus: 'PENDING', canUploadReceipt: true });

      // The cart is empty now.
      const empty = await place(agent, { addressId, expectedTotal: 0 }).expect(400);
      expect(empty.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('refuses an address whose area no longer delivers', async () => {
      const closing = await createArea(testApp.app, { name: 'Closing soon' });
      const nails = await createProduct(testApp.app, basics, { variants: [{ price: 100, stock: 10 }] });
      const { agent, cart } = await shopper([{ product: nails, qty: 1 }]);
      const [, second] = (
        await agent
          .post('/api/account/addresses')
          .set('Origin', ORIGIN)
          .send({ label: 'Other', contactName: 'Ahmed Raza', phone: '03001234567', line1: 'Street 1', areaId: closing })
          .expect(201)
      ).body.data as { id: string }[];
      await modelOf<DeliveryArea>(testApp.app, DeliveryArea.name)
        .updateOne({ _id: new Types.ObjectId(closing) }, { $set: { isServiceable: false } })
        .exec();

      const res = await place(agent, { addressId: second?.id as string, expectedTotal: cart.total });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toEqual({ path: 'addressId', message: "We don't deliver to Closing soon yet." });
    });
  });

  describe('after placing', () => {
    it('ownership: another customer gets 404 for your order', async () => {
      const brick = await createProduct(testApp.app, basics, { variants: [{ price: 20, stock: 1_000 }] });
      const { agent, addressId, cart } = await shopper([{ product: brick, qty: 100 }]);
      const order = (await place(agent, { addressId, expectedTotal: cart.total }).expect(201)).body.data as CustomerOrderDTO;

      const stranger = await customerAgent(testApp.app);
      await stranger.agent.get(`/api/orders/${order.orderNumber}`).expect(404);
      await stranger.agent.post(`/api/orders/${order.orderNumber}/cancel`).set('Origin', ORIGIN).send({ reason: 'Not mine' }).expect(404);
      await stranger.agent.post(`/api/orders/${order.orderNumber}/reorder`).set('Origin', ORIGIN).expect(404);
      await agent.get('/api/orders/ARC-1999-000001').expect(404);
      await agent.get('/api/orders/not-an-order').expect(404);
    });

    it('the customer can cancel while NEW: stock comes back with a CANCEL movement', async () => {
      const glue = await createProduct(testApp.app, basics, { variants: [{ price: 900, stock: 20 }] });
      const { agent, addressId, cart } = await shopper([{ product: glue, qty: 4 }]);
      const order = (await place(agent, { addressId, expectedTotal: cart.total }).expect(201)).body.data as CustomerOrderDTO;
      expect(await stockOf(glue)).toBe(16);

      await agent.post(`/api/orders/${order.orderNumber}/cancel`).set('Origin', ORIGIN).send({ reason: 'x' }).expect(400);
      const res = await agent
        .post(`/api/orders/${order.orderNumber}/cancel`)
        .set('Origin', ORIGIN)
        .send({ reason: 'Ordered the wrong one.' })
        .expect(200);
      expect(res.body.data).toMatchObject({ status: 'CANCELLED', cancelReason: 'Ordered the wrong one.', canCancel: false });
      expect(res.body.data.statusHistory.map((entry: { status: string }) => entry.status)).toEqual(['NEW', 'CANCELLED']);

      expect(await stockOf(glue)).toBe(20);
      const cancelMove = await movements().findOne({ refId: new Types.ObjectId(order.id), reason: 'CANCEL' }).lean().exec();
      expect(cancelMove).toMatchObject({ change: 4, stockAfter: 20 });

      // Only once.
      const twice = await agent
        .post(`/api/orders/${order.orderNumber}/cancel`)
        .set('Origin', ORIGIN)
        .send({ reason: 'Again please.' })
        .expect(409);
      expect(twice.body.error.code).toBe('INVALID_TRANSITION');
      expect(await stockOf(glue)).toBe(20);
    });

    it('the customer cannot cancel once the order is confirmed', async () => {
      const tape = await createProduct(testApp.app, basics, { variants: [{ price: 150, stock: 20 }] });
      const { agent, addressId, cart } = await shopper([{ product: tape, qty: 1 }]);
      const order = (await place(agent, { addressId, expectedTotal: cart.total }).expect(201)).body.data as CustomerOrderDTO;
      await orders().updateOne({ _id: new Types.ObjectId(order.id) }, { $set: { status: 'CONFIRMED' } }).exec();

      const res = await agent
        .post(`/api/orders/${order.orderNumber}/cancel`)
        .set('Origin', ORIGIN)
        .send({ reason: 'Changed my mind.' })
        .expect(409);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
      expect(await stockOf(tape)).toBe(19);
    });

    it('reorder puts available items back in the cart and lists the rest', async () => {
      const keep = await createProduct(testApp.app, basics, { name: 'Steel bar', variants: [{ price: 250, stock: 40, label: '12 mm' }] });
      const gone = await createProduct(testApp.app, basics, { name: 'Old tile', variants: [{ price: 100, stock: 40, label: 'Ivory' }] });
      const { agent, addressId, cart } = await shopper([
        { product: keep, qty: 10 },
        { product: gone, qty: 5 },
      ]);
      const order = (await place(agent, { addressId, expectedTotal: cart.total }).expect(201)).body.data as CustomerOrderDTO;
      await products().updateOne({ _id: new Types.ObjectId(gone.id) }, { $set: { status: 'hidden' } }).exec();

      const res = await agent.post(`/api/orders/${order.orderNumber}/reorder`).set('Origin', ORIGIN).expect(200);
      expect(res.body.data.skipped).toEqual([{ productName: 'Old tile', variantLabel: 'Ivory', reason: 'No longer available.' }]);
      expect(res.body.data.cart.lines.map((line: { variantId: string; qty: number }) => [line.variantId, line.qty])).toEqual([
        [keep.variantIds[0], 10],
      ]);
      const stored = await modelOf<Cart>(testApp.app, Cart.name).findOne({}).sort({ updatedAt: -1 }).lean().exec();
      expect(stored?.items).toHaveLength(1);
    });
  });
});
