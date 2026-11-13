import {
  IDEMPOTENCY_HEADER,
  type AdminOrderDTO,
  type CodReportDTO,
  type CustomerOrderDTO,
  type SalesReportDTO,
} from '@aricon/shared';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLog } from '../src/models/audit-log.model.js';
import { Rider } from '../src/models/rider.model.js';
import { ORIGIN } from './utils/auth.js';
import {
  createArea,
  createCatalogBasics,
  createProduct,
  customerAgent,
  modelOf,
  staffAgent,
  type Agent,
  type CreatedProduct,
} from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/**
 * Staff discount on orders they create (SPEC §6.6c), the COD short/extra trail (SPEC §6.8) and the
 * finance numbers the reports show from them (SPEC §7.3).
 */
describe('Admin discount, COD difference and finance reports', () => {
  let testApp: TestApp;
  let areaId: string;
  let product: CreatedProduct;
  let admin: Agent;
  let adminId: string;
  let creator: Agent;
  let riderId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    const basics = await createCatalogBasics(testApp.app);
    areaId = await createArea(testApp.app, { name: 'Gulshan', deliveryFee: 400 });
    product = await createProduct(testApp.app, basics, { name: 'Finance cement', variants: [{ price: 1_000, stock: 100 }] });
    ({ agent: admin, id: adminId } = await staffAgent(testApp.app, { role: 'ADMIN' }));
    // Can create orders, but has no `orders.discount`.
    ({ agent: creator } = await staffAgent(testApp.app, {
      permissions: ['orders.view', 'customers.view', 'orders.create', 'orders.update_status', 'orders.assign_rider', 'orders.cod_collect'],
    }));
    const rider = await modelOf<Rider>(testApp.app, Rider.name).create({ name: 'Imran Ali', phone: '+923121234567' });
    riderId = String(rider._id);
  });

  afterAll(async () => {
    await testApp?.close();
  });

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

  const items = (qty: number) => [{ productId: product.id, variantId: product.variantIds[0], qty }];
  const create = (agent: Agent, body: object) =>
    agent.post('/api/admin/orders').set('Origin', ORIGIN).set(IDEMPOTENCY_HEADER, randomUUID()).send(body);
  const quote = (agent: Agent, body: object) => agent.post('/api/admin/orders/quote').set('Origin', ORIGIN).send(body);
  const post = (agent: Agent, path: string, body: object = {}) => agent.post(`/api/admin/orders/${path}`).set('Origin', ORIGIN).send(body);

  it('a discount needs the orders.discount permission', async () => {
    const customer = await customerWithAddress();
    const body = { userId: customer.userId, addressId: customer.addressId, items: items(3), discountAmount: 200 };
    await quote(creator, body).expect(403);
    await create(creator, { ...body, paymentMethod: 'COD', discountReason: 'Regular customer', expectedTotal: 3_200 }).expect(403);
    // Without a discount the same staff member can still create the order.
    await create(creator, { userId: customer.userId, addressId: customer.addressId, items: items(1), paymentMethod: 'COD', expectedTotal: 1_400 }).expect(201);
  });

  it('takes the discount off the subtotal (not the delivery), keeps the reason, and shows it to the customer', async () => {
    const customer = await customerWithAddress();
    const base = { userId: customer.userId, addressId: customer.addressId, items: items(3) };

    const priced = (await quote(admin, { ...base, discountAmount: 200 }).expect(200)).body.data as { subtotal: number; deliveryFee: number; discount: number; total: number };
    expect(priced).toMatchObject({ subtotal: 3_000, deliveryFee: 400, discount: 200, total: 3_200 });

    const res = await create(admin, { ...base, paymentMethod: 'COD', discountAmount: 200, discountReason: 'Regular customer', expectedTotal: 3_200 }).expect(201);
    const order = res.body.data as AdminOrderDTO;
    expect(order).toMatchObject({ subtotal: 3_000, deliveryFee: 400, discount: 200, discountReason: 'Regular customer', total: 3_200 });

    const mine = (await customer.agent.get(`/api/orders/${order.orderNumber}`).expect(200)).body.data as CustomerOrderDTO;
    expect(mine).toMatchObject({ discount: 200, total: 3_200 });

    const audit = await modelOf<AuditLog>(testApp.app, AuditLog.name).findOne({ action: 'order.created', entityId: order.id }).lean().exec();
    expect(audit?.after).toMatchObject({ discount: 200, discountReason: 'Regular customer', total: 3_200 });
    expect(String(audit?.actorId)).toBe(adminId);
  });

  it('refuses a discount without a reason, one above the subtotal, and a stale total', async () => {
    const customer = await customerWithAddress();
    const base = { userId: customer.userId, addressId: customer.addressId, items: items(1), paymentMethod: 'COD' };

    const noReason = await create(admin, { ...base, discountAmount: 100, expectedTotal: 1_300 }).expect(400);
    expect(noReason.body.error.details).toBeDefined();
    await create(admin, { ...base, discountAmount: 1_001, discountReason: 'Too much', expectedTotal: 399 }).expect(400);
    // The total in the form must be the discounted one.
    const stale = await create(admin, { ...base, discountAmount: 100, discountReason: 'Loyal', expectedTotal: 1_400 }).expect(409);
    expect(stale.body.error.code).toBe('PRICE_CHANGED');
  });

  it('COD: a short collection keeps its reason, and the order list, COD report and finance report show the difference', async () => {
    const customer = await customerWithAddress();
    // Order A: bill 3,400, collected 3,000.
    const a = (await create(admin, { userId: customer.userId, addressId: customer.addressId, items: items(3), paymentMethod: 'COD', expectedTotal: 3_400 }).expect(201)).body.data as AdminOrderDTO;
    await post(creator, `${a.id}/status`, { to: 'CONFIRMED' }).expect(200);
    await post(creator, `${a.id}/rider`, { riderId }).expect(200);
    await post(creator, `${a.id}/status`, { to: 'DISPATCHED' }).expect(200);
    await post(creator, `${a.id}/cod-collected`, { amount: 3_000 }).expect(400); // needs the reason
    const paid = (await post(creator, `${a.id}/cod-collected`, { amount: 3_000, note: 'Customer paid Rs 400 less on site' }).expect(200)).body.data as AdminOrderDTO;
    expect(paid.codCollected).toMatchObject({ amount: 3_000, note: 'Customer paid Rs 400 less on site' });

    const listed = (await admin.get(`/api/admin/orders?q=${a.orderNumber}`).expect(200)).body.data as { id: string; codCollectedAmount: number | null; total: number }[];
    expect(listed[0]).toMatchObject({ id: a.id, codCollectedAmount: 3_000, total: 3_400 });

    // Order B: a discounted order that is still unpaid.
    await create(admin, { userId: customer.userId, addressId: customer.addressId, items: items(3), paymentMethod: 'COD', discountAmount: 200, discountReason: 'Loyal', expectedTotal: 3_200 }).expect(201);

    const cod = (await admin.get('/api/admin/reports/cod').expect(200)).body.data as CodReportDTO;
    expect(cod.totals).toMatchObject({ expected: 3_400, collected: 3_000, short: 400, extra: 0, collectedOrders: 1, pendingOrders: 3 });
    expect(cod.differences).toEqual([
      expect.objectContaining({ orderId: a.id, orderNumber: a.orderNumber, total: 3_400, collected: 3_000, difference: -400, note: 'Customer paid Rs 400 less on site' }),
    ]);
    expect(cod.byRider.find((row) => row.riderName === 'Imran Ali')).toMatchObject({ expected: 3_400, collected: 3_000, short: 400 });

    const sales = (await admin.get('/api/admin/reports/sales').expect(200)).body.data as SalesReportDTO;
    // Orders in this file: Rs 1,400 and 3,200 (discounted) from the first tests, then A (3,400) and B (3,200, discounted).
    expect(sales.totals).toMatchObject({ revenue: 11_200, discounts: 400, collected: 3_000, pending: 7_800 });
    // What was billed = what came in + what is still to come + the part of A that was not collected.
    expect(sales.totals.collected + sales.totals.pending + cod.totals.short).toBe(sales.totals.revenue);
    expect(sales.byPayment.find((row) => row.method === 'COD')?.collected).toBe(3_000);
    expect(sales.totals.subtotal - sales.totals.discounts + sales.totals.deliveryFees).toBe(sales.totals.revenue);
  });
});
