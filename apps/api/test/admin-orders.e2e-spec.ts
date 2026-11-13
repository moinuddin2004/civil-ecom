import { PERMISSION_PRESETS, type AdminOrderDTO } from '@aricon/shared';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLog } from '../src/models/audit-log.model.js';
import { Order } from '../src/models/order.model.js';
import { Product } from '../src/models/product.model.js';
import { Rider } from '../src/models/rider.model.js';
import { ORIGIN } from './utils/auth.js';
import {
  createArea,
  createCatalogBasics,
  createProduct,
  modelOf,
  placeOrder,
  staffAgent,
  type Agent,
  type CatalogBasics,
  type CreatedProduct,
} from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** Staff order management (SPEC §6.7–6.8, §7.3; Phase 2b MUST: payment → confirm, rider rule, restock, audit). */
describe('Admin orders', () => {
  let testApp: TestApp;
  let basics: CatalogBasics;
  let areaId: string;
  let product: CreatedProduct;
  let admin: Agent;
  let orderManager: Agent;
  let riderId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    basics = await createCatalogBasics(testApp.app);
    areaId = await createArea(testApp.app, { name: 'Clifton', deliveryFee: 400 });
    product = await createProduct(testApp.app, basics, { variants: [{ price: 1_000, stock: 100 }] });
    ({ agent: admin } = await staffAgent(testApp.app, { role: 'ADMIN' }));
    ({ agent: orderManager } = await staffAgent(testApp.app, { permissions: [...PERMISSION_PRESETS.orderManager.permissions] }));
    const rider = await modelOf<Rider>(testApp.app, Rider.name).create({ name: 'Imran Ali', phone: '+923121234567' });
    riderId = String(rider._id);
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const stock = async () =>
    (await modelOf<Product>(testApp.app, Product.name).findById(product.id).lean().exec())?.variants[0]?.stock ?? -1;
  const post = (agent: Agent, path: string, body: object = {}) => agent.post(`/api/admin/orders/${path}`).set('Origin', ORIGIN).send(body);
  const status = (agent: Agent, id: string, to: string, extra: object = {}) => post(agent, `${id}/status`, { to, ...extra });

  it('bank transfer: confirm waits for an approved receipt', async () => {
    const { order } = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 2 }], paymentMethod: 'BANK_TRANSFER' });

    const early = await status(orderManager, order.id, 'CONFIRMED').expect(409);
    expect(early.body.error).toMatchObject({ code: 'INVALID_TRANSITION', message: 'Approve the bank transfer receipt before confirming this order.' });

    // A receipt as the (not yet built) upload endpoint will store it.
    const receiptId = new Types.ObjectId();
    await modelOf<Order>(testApp.app, Order.name)
      .updateOne(
        { _id: new Types.ObjectId(order.id) },
        {
          $set: { paymentStatus: 'AWAITING_VERIFICATION' },
          $push: { receipts: { _id: receiptId, key: `receipts/${order.id}/${String(receiptId)}.jpg`, mimeType: 'image/jpeg', sizeBytes: 1_000 } },
        },
      )
      .exec();

    const approved = (await post(orderManager, `${order.id}/receipts/${String(receiptId)}/approve`).expect(200)).body.data as AdminOrderDTO;
    expect(approved.paymentStatus).toBe('PAID');
    expect(approved.receipts[0]).toMatchObject({ status: 'approved', reviewedByName: 'Staff Member' });
    await post(orderManager, `${order.id}/receipts/${String(receiptId)}/approve`).expect(409);

    const confirmed = (await status(orderManager, order.id, 'CONFIRMED').expect(200)).body.data as AdminOrderDTO;
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.statusHistory.map((entry) => [entry.status, entry.byType])).toEqual([
      ['NEW', 'customer'],
      ['CONFIRMED', 'staff'],
    ]);
  });

  it('a rejected receipt (the only pending one) sets payment to REJECTED', async () => {
    const { order } = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 1 }], paymentMethod: 'BANK_TRANSFER' });
    const receiptId = new Types.ObjectId();
    await modelOf<Order>(testApp.app, Order.name)
      .updateOne(
        { _id: new Types.ObjectId(order.id) },
        { $push: { receipts: { _id: receiptId, key: 'receipts/x/y.pdf', mimeType: 'application/pdf', sizeBytes: 500 } } },
      )
      .exec();
    await post(orderManager, `${order.id}/receipts/${String(receiptId)}/reject`, { reason: 'no' }).expect(400);
    const rejected = (await post(orderManager, `${order.id}/receipts/${String(receiptId)}/reject`, { reason: 'Amount does not match.' }).expect(200))
      .body.data as AdminOrderDTO;
    expect(rejected.paymentStatus).toBe('REJECTED');
    expect(rejected.receipts[0]).toMatchObject({ status: 'rejected', rejectReason: 'Amount does not match.' });
  });

  it('COD: dispatch needs a rider; then deliver and record the cash', async () => {
    const { order, agent: customer } = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 3 }] });
    await status(orderManager, order.id, 'CONFIRMED').expect(200);

    const noRider = await status(orderManager, order.id, 'DISPATCHED').expect(409);
    expect(noRider.body.error.message).toBe('Assign a rider before marking the order dispatched.');

    const assigned = (await post(orderManager, `${order.id}/rider`, { riderId }).expect(200)).body.data as AdminOrderDTO;
    expect(assigned.rider).toEqual({ name: 'Imran Ali', phone: '+923121234567' });

    // The list rows carry the rider id too, so the list can show the rider picker and the dispatch rule.
    const listed = (await orderManager.get(`/api/admin/orders?q=${order.orderNumber}`).expect(200)).body.data as { id: string; riderId: string | null; riderName: string | null }[];
    expect(listed.find((row) => row.id === order.id)).toMatchObject({ riderId, riderName: 'Imran Ali' });

    await status(orderManager, order.id, 'DISPATCHED').expect(200);
    expect((await customer.get(`/api/orders/${order.orderNumber}`).expect(200)).body.data.rider).toEqual({
      name: 'Imran Ali',
      phone: '+923121234567',
    });

    await post(orderManager, `${order.id}/cod-collected`, { amount: order.total - 100 }).expect(400); // needs a note
    const paid = (await post(orderManager, `${order.id}/cod-collected`, { amount: order.total }).expect(200)).body.data as AdminOrderDTO;
    expect(paid).toMatchObject({ paymentStatus: 'PAID', codCollected: { amount: order.total, byName: 'Staff Member' } });
    await post(orderManager, `${order.id}/cod-collected`, { amount: order.total }).expect(409);

    await status(orderManager, order.id, 'DELIVERED').expect(200);
    await status(orderManager, order.id, 'CONFIRMED').expect(409);
  });

  it('cancel needs orders.cancel and returns stock; a paid return becomes REFUNDED', async () => {
    const before = await stock();
    const { order } = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 4 }] });
    expect(await stock()).toBe(before - 4);

    const denied = await status(orderManager, order.id, 'CANCELLED', { reason: 'Customer called' }).expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    await status(admin, order.id, 'CANCELLED').expect(400); // reason required

    const cancelled = (await status(admin, order.id, 'CANCELLED', { reason: 'Customer called to cancel' }).expect(200)).body.data as AdminOrderDTO;
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelReason: 'Customer called to cancel' });
    expect(await stock()).toBe(before);

    // Return after delivery and payment.
    const second = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 5 }] });
    await status(admin, second.order.id, 'CONFIRMED').expect(200);
    await post(admin, `${second.order.id}/rider`, { riderId }).expect(200);
    await status(admin, second.order.id, 'DISPATCHED').expect(200);
    await status(admin, second.order.id, 'DELIVERED').expect(200);
    await post(admin, `${second.order.id}/cod-collected`, { amount: second.order.total }).expect(200);
    const returned = (await status(admin, second.order.id, 'RETURNED').expect(200)).body.data as AdminOrderDTO;
    expect(returned).toMatchObject({ status: 'RETURNED', paymentStatus: 'REFUNDED' });
    expect(await stock()).toBe(before);

    const logs = await modelOf<AuditLog>(testApp.app, AuditLog.name)
      .find({ action: 'order.status_changed', entityId: second.order.id })
      .sort({ at: 1 })
      .lean()
      .exec();
    expect(logs.map((log) => log.after?.status)).toEqual(['CONFIRMED', 'DISPATCHED', 'DELIVERED', 'RETURNED']);
  });

  it('lists with filters and status counts; internal notes stay staff-only', async () => {
    const { order, agent: customer } = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 1 }] });
    await admin.patch(`/api/admin/orders/${order.id}/internal-note`).set('Origin', ORIGIN).send({ internalNote: 'Gate code 4411' }).expect(200);
    expect((await customer.get(`/api/orders/${order.orderNumber}`).expect(200)).body.data).not.toHaveProperty('internalNote');

    const byNumber = await orderManager.get(`/api/admin/orders?q=${order.orderNumber}`).expect(200);
    expect(byNumber.body.data.map((row: { id: string }) => row.id)).toEqual([order.id]);
    expect(byNumber.body.statusCounts.all).toBe(1);

    const newOnes = await orderManager.get('/api/admin/orders?status=NEW&sort=total:asc').expect(200);
    expect(newOnes.body.data.every((row: { status: string }) => row.status === 'NEW')).toBe(true);
    expect(newOnes.body.statusCounts.NEW).toBe(newOnes.body.meta.total);

    const detail = (await orderManager.get(`/api/admin/orders/${order.id}`).expect(200)).body.data as AdminOrderDTO;
    expect(detail).toMatchObject({ internalNote: 'Gate code 4411', customer: { name: 'Test Customer' } });
  });
});
