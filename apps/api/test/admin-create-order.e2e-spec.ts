import { IDEMPOTENCY_HEADER, PERMISSION_PRESETS, type AdminOrderDTO, type AdminOrderProductOptionDTO, type PricedCart } from '@aricon/shared';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLog } from '../src/models/audit-log.model.js';
import { Order } from '../src/models/order.model.js';
import { Product } from '../src/models/product.model.js';
import { User } from '../src/models/user.model.js';
import { ORIGIN } from './utils/auth.js';
import {
  createArea,
  createCatalogBasics,
  createProduct,
  customerAgent,
  modelOf,
  staffAgent,
  type Agent,
  type CatalogBasics,
  type CreatedProduct,
} from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** Staff create an order for a customer (SPEC §6.6a): same pricing, stock and idempotency rules as checkout. */
describe('Admin create order', () => {
  let testApp: TestApp;
  let basics: CatalogBasics;
  let areaId: string;
  let product: CreatedProduct;
  let admin: Agent;
  let adminId: string;
  let viewOnly: Agent;

  beforeAll(async () => {
    testApp = await createTestApp();
    basics = await createCatalogBasics(testApp.app);
    areaId = await createArea(testApp.app, { name: 'Gulshan', deliveryFee: 400 });
    product = await createProduct(testApp.app, basics, { name: 'Staff order cement', variants: [{ price: 1_000, stock: 100 }] });
    ({ agent: admin, id: adminId } = await staffAgent(testApp.app, { role: 'ADMIN' }));
    ({ agent: viewOnly } = await staffAgent(testApp.app, { permissions: ['orders.view', 'customers.view'] }));
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const stockOf = async (target: CreatedProduct = product) =>
    (await modelOf<Product>(testApp.app, Product.name).findById(target.id).lean().exec())?.variants[0]?.stock ?? -1;

  /** A customer with one saved address in the test area. */
  async function customerWithAddress() {
    const customer = await customerAgent(testApp.app);
    const [address] = (
      await customer.agent
        .post('/api/account/addresses')
        .set('Origin', ORIGIN)
        .send({ label: 'Site', contactName: 'Ahmed Raza', phone: '03001234567', line1: 'Plot 12, Block 5', areaId })
        .expect(201)
    ).body.data as { id: string }[];
    return { ...customer, addressId: address?.id ?? '' };
  }

  const lines = (target: CreatedProduct = product, qty = 3) => [{ productId: target.id, variantId: target.variantIds[0], qty }];
  const create = (agent: Agent, body: object, key: string = randomUUID()) =>
    agent.post('/api/admin/orders').set('Origin', ORIGIN).set(IDEMPOTENCY_HEADER, key).send(body);
  const quote = (agent: Agent, body: object) => agent.post('/api/admin/orders/quote').set('Origin', ORIGIN).send(body);

  it('needs the orders.create permission on every endpoint', async () => {
    const customer = await customerWithAddress();
    const body = { userId: customer.userId, addressId: customer.addressId, items: lines() };
    await quote(viewOnly, body).expect(403);
    await create(viewOnly, { ...body, paymentMethod: 'COD', expectedTotal: 3_400 }).expect(403);
    await viewOnly.get('/api/admin/orders/product-options?q=cement').expect(403);
    // The Order Manager preset includes it.
    expect(PERMISSION_PRESETS.orderManager.permissions).toContain('orders.create');
  });

  it('finds active variants by name or SKU', async () => {
    const res = await admin.get('/api/admin/orders/product-options?q=Staff order').expect(200);
    const options = res.body.data as AdminOrderProductOptionDTO[];
    expect(options).toEqual([
      expect.objectContaining({ productId: product.id, variantId: product.variantIds[0], productName: 'Staff order cement', price: 1_000, stock: 100 }),
    ]);
    expect((await admin.get('/api/admin/orders/product-options?q=s').expect(200)).body.data).toEqual([]);
  });

  it('prices the order with the delivery fee of the customer address', async () => {
    const customer = await customerWithAddress();
    const res = await quote(admin, { userId: customer.userId, addressId: customer.addressId, items: lines() }).expect(200);
    expect(res.body.data).toMatchObject({ subtotal: 3_000, deliveryFee: 400, total: 3_400, canCheckout: true });
  });

  it('creates the order: stock down, staff in the history, cart untouched, audit logged, visible to the customer', async () => {
    const customer = await customerWithAddress();
    // The customer has something in their own cart; the staff order must not touch it.
    await customer.agent.put('/api/cart/items').set('Origin', ORIGIN).send({ variantId: product.variantIds[0], qty: 2 }).expect(200);
    const before = await stockOf();

    const res = await create(admin, {
      userId: customer.userId,
      addressId: customer.addressId,
      items: lines(product, 3),
      paymentMethod: 'COD',
      customerNote: 'Phone order, call on arrival',
      expectedTotal: 3_400,
    }).expect(201);
    const order = res.body.data as AdminOrderDTO;

    expect(order).toMatchObject({ status: 'NEW', paymentMethod: 'COD', subtotal: 3_000, deliveryFee: 400, total: 3_400 });
    expect(order.statusHistory.map((entry) => [entry.status, entry.byType])).toEqual([['NEW', 'staff']]);
    expect(await stockOf()).toBe(before - 3);

    const cart = (await customer.agent.get('/api/cart').expect(200)).body.data as PricedCart;
    expect(cart.lines.map((line) => line.qty)).toEqual([2]);

    const audit = await modelOf<AuditLog>(testApp.app, AuditLog.name).findOne({ action: 'order.created', entityId: order.id }).lean().exec();
    expect(audit).toMatchObject({ entity: 'order' });
    expect(String(audit?.actorId)).toBe(adminId);

    const mine = (await customer.agent.get('/api/orders').expect(200)).body.data as { orderNumber: string }[];
    expect(mine.map((item) => item.orderNumber)).toContain(order.orderNumber);
  });

  it('the same Idempotency-Key returns the same order and takes stock once', async () => {
    const customer = await customerWithAddress();
    const key = randomUUID();
    const body = { userId: customer.userId, addressId: customer.addressId, items: lines(product, 1), paymentMethod: 'COD', expectedTotal: 1_400 };
    const before = await stockOf();

    const first = await create(admin, body, key).expect(201);
    const second = await create(admin, body, key).expect(200);
    expect((second.body.data as AdminOrderDTO).id).toBe((first.body.data as AdminOrderDTO).id);
    expect(await stockOf()).toBe(before - 1);
    expect(await modelOf<Order>(testApp.app, Order.name).countDocuments({ idempotencyKey: key })).toBe(1);
  });

  it('a total that no longer matches is PRICE_CHANGED and nothing is saved', async () => {
    const customer = await customerWithAddress();
    const before = await stockOf();
    const res = await create(admin, {
      userId: customer.userId,
      addressId: customer.addressId,
      items: lines(product, 1),
      paymentMethod: 'COD',
      expectedTotal: 999,
    }).expect(409);
    expect(res.body.error.code).toBe('PRICE_CHANGED');
    expect(await stockOf()).toBe(before);
  });

  it('refuses a blocked customer, a non-customer and another customer’s address', async () => {
    const customer = await customerWithAddress();
    const other = await customerWithAddress();
    const body = { userId: customer.userId, addressId: customer.addressId, items: lines(product, 1), paymentMethod: 'COD', expectedTotal: 1_400 };

    await create(admin, { ...body, addressId: other.addressId }).expect(400);
    await create(admin, { ...body, userId: adminId }).expect(400);

    await modelOf<User>(testApp.app, User.name).updateOne({ _id: customer.userId }, { $set: { status: 'blocked' } }).exec();
    const blocked = await create(admin, body).expect(400);
    expect(blocked.body.error.details).toBeDefined();
  });

  it('two staff orders for the last units: exactly one succeeds, no overselling', async () => {
    const scarce = await createProduct(testApp.app, basics, { name: 'Last five bags', variants: [{ price: 500, stock: 5 }] });
    const a = await customerWithAddress();
    const b = await customerWithAddress();
    const body = (customer: { userId: string; addressId: string }) => ({
      userId: customer.userId,
      addressId: customer.addressId,
      items: lines(scarce, 5),
      paymentMethod: 'COD',
      expectedTotal: 2_900,
    });

    const results = await Promise.all([create(admin, body(a)), create(admin, body(b))]);
    expect(results.map((res) => res.status).sort((x, y) => x - y)).toEqual([201, 409]);
    expect(results.find((res) => res.status === 409)?.body.error.code).toBe('OUT_OF_STOCK');
    expect(await stockOf(scarce)).toBe(0);
  });
});
