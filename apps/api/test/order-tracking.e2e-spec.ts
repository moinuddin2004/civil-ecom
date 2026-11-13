import type { CustomerOrderDTO, OrderTrackingDTO } from '@aricon/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ORIGIN } from './utils/auth.js';
import { createArea, createCatalogBasics, createProduct, placeOrder, type CatalogBasics, type CreatedProduct } from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** Public order tracking (SPEC §6.6b): the order's 6-digit tracking code. */
describe('Track order', () => {
  let testApp: TestApp;
  let basics: CatalogBasics;
  let areaId: string;
  let product: CreatedProduct;

  beforeAll(async () => {
    testApp = await createTestApp();
    basics = await createCatalogBasics(testApp.app);
    areaId = await createArea(testApp.app, { name: 'Gulberg', deliveryFee: 300 });
    product = await createProduct(testApp.app, basics, { variants: [{ price: 1_000, stock: 50 }] });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const track = (body: object) =>
    request(testApp.app.getHttpServer() as Parameters<typeof request>[0])
      .post('/api/public/track-order')
      .set('Origin', ORIGIN)
      .send(body);

  it('every order gets its own 6-digit tracking code', async () => {
    const first = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 1 }] });
    const second = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 1 }] });
    const codeOf = async (placed: typeof first) =>
      ((await placed.agent.get(`/api/orders/${placed.order.orderNumber}`).expect(200)).body.data as CustomerOrderDTO).trackingCode;

    const [a, b] = [await codeOf(first), await codeOf(second)];
    expect(a).toMatch(/^[1-9]\d{5}$/);
    expect(b).toMatch(/^[1-9]\d{5}$/);
    expect(a).not.toBe(b);

    // The customer's order list carries it too, for the copy button.
    const listed = (await first.agent.get('/api/orders').expect(200)).body.data as { orderNumber: string; trackingCode: string | null }[];
    expect(listed[0]).toMatchObject({ orderNumber: first.order.orderNumber, trackingCode: a });
  });

  it('shows the status trail to whoever has the code, and nothing else', async () => {
    const placed = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 2 }] });
    const { trackingCode } = (await placed.agent.get(`/api/orders/${placed.order.orderNumber}`).expect(200)).body.data as CustomerOrderDTO;

    const res = await track({ code: trackingCode }).expect(200);
    const data = res.body.data as OrderTrackingDTO;
    expect(data).toMatchObject({ orderNumber: placed.order.orderNumber, status: 'NEW', riderName: null });
    expect(data.history.map((entry) => entry.status)).toEqual(['NEW']);
    // No personal or commercial data comes back.
    expect(Object.keys(data).sort()).toEqual(['createdAt', 'history', 'orderNumber', 'riderName', 'status']);
    expect(JSON.stringify(res.body)).not.toMatch(/Plot 12|Ahmed|1000|2000|\+92|0300/);
  });

  it('answers a code that matches no order with a 404', async () => {
    const placed = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 1 }] });
    const { trackingCode } = (await placed.agent.get(`/api/orders/${placed.order.orderNumber}`).expect(200)).body.data as CustomerOrderDTO;
    // Some other 6-digit code that no order has.
    const other = trackingCode === '123456' ? '654321' : '123456';
    const res = await track({ code: other }).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects anything that is not 6 digits', async () => {
    await track({ code: '12345' }).expect(400);
    await track({ code: '1234567' }).expect(400);
    await track({ code: 'ABC123' }).expect(400);
    await track({ orderNumber: 'ARC-2026-000123' }).expect(400);
    await track({}).expect(400);
  });
});
