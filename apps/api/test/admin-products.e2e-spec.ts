import type { AdminProductDTO } from '@aricon/shared';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLog } from '../src/models/audit-log.model.js';
import { StockMovement } from '../src/models/stock-movement.model.js';
import { ORIGIN } from './utils/auth.js';
import { createCatalogBasics, modelOf, staffAgent, type Agent, type CatalogBasics } from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** Admin products and stock (SPEC §7.3, §6.10; Phase 2b MUST: price/stock permissions, stock only via adjustments). */
describe('Admin products', () => {
  let testApp: TestApp;
  let basics: CatalogBasics;
  let admin: Agent;
  let editor: Agent; // products.edit without products.edit_price / edit_stock
  let creator: Agent; // products.create without products.edit_stock

  beforeAll(async () => {
    testApp = await createTestApp();
    basics = await createCatalogBasics(testApp.app);
    ({ agent: admin } = await staffAgent(testApp.app, { role: 'ADMIN' }));
    ({ agent: editor } = await staffAgent(testApp.app, { permissions: ['products.view', 'products.edit'] }));
    ({ agent: creator } = await staffAgent(testApp.app, { permissions: ['products.view', 'products.create'] }));
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const body = (overrides: Record<string, unknown> = {}) => ({
    name: 'Lucky OPC Cement',
    brandId: String(basics.brandId),
    categoryId: String(basics.categoryId),
    unit: 'bag',
    type: 'OPC',
    status: 'active',
    variants: [
      {
        sku: `opc-${new Types.ObjectId().toHexString().slice(-8)}`,
        label: '50 kg bag',
        options: { packSize: '50 kg' },
        mrp: 450,
        price: 425,
        bulkTiers: [
          { minQty: 10, price: 415 },
          { minQty: 50, price: 395 },
        ],
        stock: 40,
      },
    ],
    ...overrides,
  });

  const create = (agent: Agent, overrides: Record<string, unknown> = {}) =>
    agent.post('/api/admin/products').set('Origin', ORIGIN).send(body(overrides));

  it('creates a product with variants, initial stock movement and audit entry', async () => {
    const res = await create(admin).expect(201);
    const product = res.body.data as AdminProductDTO;
    expect(product).toMatchObject({ slug: 'lucky-opc-cement', status: 'active', minPrice: 425, maxPrice: 425, totalStock: 40 });
    expect(product.variants[0]).toMatchObject({ stock: 40, isLowStock: false, lowStockThreshold: 5 });
    expect(product.variants[0]?.sku).toMatch(/^OPC-/);

    const moves = await modelOf<StockMovement>(testApp.app, StockMovement.name).find({ productId: new Types.ObjectId(product.id) }).lean().exec();
    expect(moves).toEqual([expect.objectContaining({ change: 40, stockAfter: 40, reason: 'ADJUST', note: 'Initial stock' })]);
    expect(await modelOf<AuditLog>(testApp.app, AuditLog.name).countDocuments({ action: 'product.created', entityId: product.id })).toBe(1);

    // Same slug again: 409 on the slug.
    const again = await create(admin).expect(409);
    expect(again.body.error.details[0].path).toBe('slug');
  });

  it('checks pricing rules with the shared messages', async () => {
    const res = await create(admin, {
      name: 'Bad tiers',
      variants: [{ sku: 'BAD-1', label: 'Bag', mrp: 400, price: 425, bulkTiers: [{ minQty: 10, price: 430 }] }],
    }).expect(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { path: 'variants.0.mrp', message: "MRP can't be lower than the price." },
        { path: 'variants.0.bulkTiers.0.price', message: 'Tier price must be lower than the base price.' },
      ]),
    );
  });

  it('initial stock needs products.edit_stock', async () => {
    const res = await create(creator, { name: 'Creator product' }).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    const zero = body({ name: 'Creator product' });
    (zero.variants as { stock?: number }[])[0]!.stock = 0;
    await creator.post('/api/admin/products').set('Origin', ORIGIN).send(zero).expect(201);
  });

  it('products.edit without products.edit_price can rename but not reprice (403, nothing saved)', async () => {
    const product = (await create(admin, { name: 'Bestway Cement' }).expect(201)).body.data as AdminProductDTO;
    const variantId = product.variants[0]!.id;

    const renamed = await editor
      .patch(`/api/admin/products/${product.id}`)
      .set('Origin', ORIGIN)
      .send({ name: 'Bestway Cement PPC', variants: [{ id: variantId, label: '50 kg bag (PPC)' }] })
      .expect(200);
    expect(renamed.body.data).toMatchObject({ name: 'Bestway Cement PPC', variants: [{ label: '50 kg bag (PPC)', price: 425 }] });

    const repriced = await editor
      .patch(`/api/admin/products/${product.id}`)
      .set('Origin', ORIGIN)
      .send({ name: 'Should not stick', variants: [{ id: variantId, price: 410 }] })
      .expect(403);
    expect(repriced.body.error.code).toBe('FORBIDDEN');
    await editor.patch(`/api/admin/products/${product.id}/variants/${variantId}`).set('Origin', ORIGIN).send({ bulkTiers: [] }).expect(403);

    const current = (await admin.get(`/api/admin/products/${product.id}`).expect(200)).body.data as AdminProductDTO;
    expect(current.name).toBe('Bestway Cement PPC');
    expect(current.variants[0]).toMatchObject({ price: 425, bulkTiers: [{ minQty: 10, price: 415 }, { minQty: 50, price: 395 }] });

    // An admin can, and it is audited as a price change.
    await admin.patch(`/api/admin/products/${product.id}/variants/${variantId}`).set('Origin', ORIGIN).send({ price: 420 }).expect(200);
    const log = await modelOf<AuditLog>(testApp.app, AuditLog.name).findOne({ action: 'product.price_changed', entityId: product.id }).lean().exec();
    expect(log?.before).toEqual({ [current.variants[0]!.sku]: { price: 425 } });
    expect(log?.after).toEqual({ [current.variants[0]!.sku]: { price: 420 } });
  });

  it('stock changes only through the adjustment endpoint', async () => {
    const product = (await create(admin, { name: 'Stock product' }).expect(201)).body.data as AdminProductDTO;
    const variantId = product.variants[0]!.id;

    // PATCH refuses `stock` outright.
    const patch = await admin
      .patch(`/api/admin/products/${product.id}`)
      .set('Origin', ORIGIN)
      .send({ variants: [{ id: variantId, stock: 999 }] })
      .expect(400);
    expect(patch.body.error.details[0].path).toBe('variants.0.stock');
    await editor
      .post(`/api/admin/products/${product.id}/stock-adjustments`)
      .set('Origin', ORIGIN)
      .send({ variantId, change: 5, reason: 'Recount' })
      .expect(403);

    const adjust = (change: number) =>
      admin.post(`/api/admin/products/${product.id}/stock-adjustments`).set('Origin', ORIGIN).send({ variantId, change, reason: 'Damaged bags' });
    const down = (await adjust(-15).expect(200)).body.data as AdminProductDTO;
    expect(down.variants[0]?.stock).toBe(25);
    expect(down.totalStock).toBe(25);

    const tooMuch = await adjust(-26).expect(400);
    expect(tooMuch.body.error.details[0]).toEqual({ path: 'change', message: 'Only 25 in stock; you can remove at most 25.' });

    const history = await admin.get(`/api/admin/stock-movements?productId=${product.id}`).expect(200);
    expect(history.body.data.map((row: { change: number; reason: string }) => [row.change, row.reason])).toEqual([
      [-15, 'ADJUST'],
      [40, 'ADJUST'],
    ]);
    expect(history.body.data[0]).toMatchObject({ stockAfter: 25, note: 'Damaged bags', productName: 'Stock product' });
  });

  it('an active product needs an active brand and category; archive hides it from the default list', async () => {
    const product = (await create(admin, { name: 'Status product', status: 'hidden' }).expect(201)).body.data as AdminProductDTO;
    await admin.post(`/api/admin/products/${product.id}/status`).set('Origin', ORIGIN).send({ status: 'archived' }).expect(200);

    const list = await admin.get('/api/admin/products?pageSize=100').expect(200);
    expect(list.body.data.map((row: { id: string }) => row.id)).not.toContain(product.id);
    const archived = await admin.get('/api/admin/products?status=archived').expect(200);
    expect(archived.body.data.map((row: { id: string }) => row.id)).toContain(product.id);

    const hiddenBrand = await admin.post('/api/admin/brands').set('Origin', ORIGIN).send({ name: 'Hidden Brand', status: 'hidden' }).expect(201);
    await admin
      .patch(`/api/admin/products/${product.id}`)
      .set('Origin', ORIGIN)
      .send({ brandId: hiddenBrand.body.data.id })
      .expect(200);
    const activate = await admin.post(`/api/admin/products/${product.id}/status`).set('Origin', ORIGIN).send({ status: 'active' }).expect(409);
    expect(activate.body.error.code).toBe('CONFLICT');
  });

  it('lists with search, low-stock filter and category names', async () => {
    const low = body({ name: 'Low stock tile', unit: 'box' });
    (low.variants as { stock?: number; lowStockThreshold?: number }[])[0]!.stock = 2;
    await admin.post('/api/admin/products').set('Origin', ORIGIN).send(low).expect(201);

    const res = await admin.get('/api/admin/products?lowStock=true&q=tile').expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ name: 'Low stock tile', hasLowStock: true, totalStock: 2 });
    expect(res.body.data[0].categoryName).toMatch(/^Category /);
  });
});
