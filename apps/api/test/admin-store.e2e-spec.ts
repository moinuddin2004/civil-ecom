import { karachiDateKey, PERMISSION_PRESETS, type AdminCategoryDTO, type AdminSettingsDTO } from '@aricon/shared';
import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Product } from '../src/models/product.model.js';
import { ORIGIN } from './utils/auth.js';
import { createArea, createProduct, modelOf, placeOrder, staffAgent, type Agent } from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** Catalog, delivery, settings, homepage, reports and the audit log in the admin API (SPEC §7.3). */
describe('Admin store management', () => {
  let testApp: TestApp;
  let server: Parameters<typeof request>[0];
  let admin: Agent;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as Parameters<typeof request>[0];
    ({ agent: admin } = await staffAgent(testApp.app, { role: 'ADMIN' }));
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const send = (method: 'post' | 'patch' | 'put', path: string, body: object) => admin[method](`/api/admin/${path}`).set('Origin', ORIGIN).send(body);

  describe('categories and brands', () => {
    it('creates, moves and hides categories under the two-level and active-product rules', async () => {
      const building = (await send('post', 'categories', { name: 'Building Materials' }).expect(201)).body.data as AdminCategoryDTO;
      expect(building.slug).toBe('building-materials');
      await send('post', 'categories', { name: 'Building materials' }).expect(409);

      const cement = (await send('post', 'categories', { name: 'Cement', parentId: building.id }).expect(201)).body.data as AdminCategoryDTO;
      await send('post', 'categories', { name: 'Too deep', parentId: cement.id }).expect(400);

      const brand = (await send('post', 'brands', { name: 'Lucky Cement' }).expect(201)).body.data as { id: string };
      const product = await createProduct(
        testApp.app,
        { brandId: new Types.ObjectId(brand.id), categoryId: new Types.ObjectId(cement.id) },
        { variants: [{ price: 500, stock: 10 }] },
      );

      const hide = await send('patch', `categories/${building.id}`, { status: 'hidden' }).expect(409);
      expect(hide.body.error.details).toEqual({ activeProducts: 1 });
      await send('patch', `categories/${building.id}`, { parentId: cement.id }).expect(400); // has a sub-category

      // Move Cement to the top level: its products' path follows.
      await send('patch', `categories/${cement.id}`, { parentId: null }).expect(200);
      const stored = await modelOf<Product>(testApp.app, Product.name).findById(product.id).lean().exec();
      expect(stored?.categoryPath.map(String)).toEqual([cement.id]);
      const list = (await admin.get('/api/admin/categories').expect(200)).body.data as AdminCategoryDTO[];
      expect(list.find((item) => item.id === cement.id)).toMatchObject({ parentId: null, productCount: 1 });

      // A brand rename reaches its products; hiding it is refused while it has active ones.
      await send('patch', `brands/${brand.id}`, { name: 'Lucky Cement Ltd' }).expect(200);
      expect((await modelOf<Product>(testApp.app, Product.name).findById(product.id).lean().exec())?.brandName).toBe('Lucky Cement Ltd');
      await send('patch', `brands/${brand.id}`, { status: 'hidden' }).expect(409);
    });

    it('rejects images uploaded for another record', async () => {
      const id = new Types.ObjectId().toHexString();
      const other = new Types.ObjectId().toHexString();
      const res = await send('post', 'categories', { id, name: 'Tiles', imageKey: `categories/${other}/image.webp` }).expect(400);
      expect(res.body.error.details[0].path).toBe('imageKey');
      await send('post', 'categories', { id, name: 'Tiles', imageKey: `categories/${id}/image.webp` }).expect(201);
    });
  });

  describe('delivery areas and riders', () => {
    it('manages areas; the public list shows the effective fee', async () => {
      const area = (await send('post', 'delivery-areas', { name: 'Malir', deliveryFee: 700 }).expect(201)).body.data as { id: string };
      await send('post', 'delivery-areas', { name: 'Malir' }).expect(409);
      await send('patch', `delivery-areas/${area.id}`, { deliveryFee: null, isServiceable: false }).expect(200);
      const publicList = (await request(server).get('/api/delivery-areas').expect(200)).body.data as { id: string; deliveryFee: number; isServiceable: boolean }[];
      expect(publicList.find((item) => item.id === area.id)).toMatchObject({ deliveryFee: 500, isServiceable: false });
    });

    it('order managers can list riders but not change them', async () => {
      const manager = await staffAgent(testApp.app, { permissions: [...PERMISSION_PRESETS.orderManager.permissions] });
      const rider = (await send('post', 'riders', { name: 'Imran Ali', phone: '0312 1234567' }).expect(201)).body.data as { id: string; phone: string };
      expect(rider.phone).toBe('+923121234567');
      expect((await manager.agent.get('/api/admin/riders').expect(200)).body.data.map((item: { id: string }) => item.id)).toContain(rider.id);
      await manager.agent.patch(`/api/admin/riders/${rider.id}`).set('Origin', ORIGIN).send({ isActive: false }).expect(403);
      await send('patch', `riders/${rider.id}`, { isActive: false }).expect(200);
    });
  });

  describe('settings and homepage', () => {
    const settings = (overrides: Partial<Record<string, unknown>> = {}) => ({
      storeName: 'Aricon Shop',
      phone: '021 3456 7890',
      whatsapp: '0300 1234567',
      email: 'shop@aricon.test',
      address: 'Shahrah-e-Faisal, Karachi',
      orderNotificationEmails: ['Orders@Aricon.test'],
      rfpEmail: 'projects@aricon.test',
      paymentMethods: { cod: true, bankTransfer: true },
      codMaxOrderAmount: 150_000,
      defaultDeliveryFee: 450,
      bankAccounts: [{ bankName: 'Meezan Bank', accountTitle: 'Aricon', accountNumber: '0101-0104567890', iban: 'pk36 mezn 0001 0101 0456 7890' }],
      bankTransferInstructions: 'Send the receipt from your order page.',
      lowStockDefault: 8,
      pages: { about: '# About', faq: '', contact: '', refundPolicy: '', deliveryPolicy: '', privacyPolicy: '', terms: '' },
      ...overrides,
    });

    it('settings are ADMIN-only, validated, audited and public where they should be', async () => {
      const manager = await staffAgent(testApp.app, { permissions: [...PERMISSION_PRESETS.catalogManager.permissions] });
      await manager.agent.get('/api/admin/settings').expect(403);

      const defaults = (await admin.get('/api/admin/settings').expect(200)).body.data as AdminSettingsDTO;
      expect(defaults.updatedAt).toBeNull();

      const off = await send('put', 'settings', settings({ paymentMethods: { cod: false, bankTransfer: false } })).expect(400);
      expect(off.body.error.details[0].path).toBe('paymentMethods');

      const saved = (await send('put', 'settings', settings()).expect(200)).body.data as AdminSettingsDTO;
      expect(saved).toMatchObject({ whatsapp: '+923001234567', orderNotificationEmails: ['orders@aricon.test'], updatedAt: expect.any(String) });
      expect(saved.bankAccounts[0]).toMatchObject({ iban: 'PK36MEZN0001010104567890', id: expect.stringMatching(/^[a-f\d]{24}$/) });

      // Keeping the account id keeps it stable across saves.
      const again = (await send('put', 'settings', settings({ bankAccounts: [{ ...settings().bankAccounts[0], id: saved.bankAccounts[0]!.id }] })).expect(200))
        .body.data as AdminSettingsDTO;
      expect(again.bankAccounts[0]!.id).toBe(saved.bankAccounts[0]!.id);

      const publicSettings = (await request(server).get('/api/settings/public').expect(200)).body.data;
      expect(publicSettings).toMatchObject({ codMaxOrderAmount: 150_000, defaultDeliveryFee: 450 });
      expect((await request(server).get('/api/pages/about').expect(200)).body.data.body).toBe('# About');

      const logs = await admin.get('/api/admin/audit-logs?entity=settings&action=settings.updated').expect(200);
      expect(logs.body.meta.total).toBe(1); // the second save changed nothing that is audited
      expect(logs.body.data[0].after).toMatchObject({ defaultDeliveryFee: 450 });
    });

    it('homepage banners and picks', async () => {
      const bannerId = new Types.ObjectId().toHexString();
      const wrongKey = await send('put', 'homepage', {
        banners: [{ id: bannerId, desktopKey: `banners/${new Types.ObjectId().toHexString()}/desktop.webp`, alt: 'Sale' }],
        featuredProductIds: [],
        dealProductIds: [],
      }).expect(400);
      expect(wrongKey.body.error.details[0].path).toBe('banners.0.desktopKey');

      const missing = await send('put', 'homepage', { banners: [], featuredProductIds: [new Types.ObjectId().toHexString()], dealProductIds: [] }).expect(400);
      expect(missing.body.error.details[0].path).toBe('featuredProductIds.0');

      await send('put', 'homepage', {
        banners: [{ id: bannerId, desktopKey: `banners/${bannerId}/desktop.webp`, alt: 'Monsoon sale', link: '//evil.example' }],
        featuredProductIds: [],
        dealProductIds: [],
      }).expect(400);

      const saved = await send('put', 'homepage', {
        banners: [{ id: bannerId, desktopKey: `banners/${bannerId}/desktop.webp`, alt: 'Monsoon sale', link: '/category/waterproofing' }],
        featuredProductIds: [],
        dealProductIds: [],
      }).expect(200);
      expect(saved.body.data.banners[0]).toMatchObject({ id: bannerId, isActive: true, sortOrder: 0 });
      expect((await request(server).get('/api/home').expect(200)).body.data.banners).toEqual([
        { id: bannerId, desktopKey: `banners/${bannerId}/desktop.webp`, mobileKey: null, alt: 'Monsoon sale', link: '/category/waterproofing' },
      ]);
    });
  });

  describe('dashboard and reports', () => {
    it('counts sales (cancelled left out) by Karachi day', async () => {
      const brand = (await send('post', 'brands', { name: 'Report Brand' }).expect(201)).body.data as { id: string };
      const category = (await send('post', 'categories', { name: 'Report Category' }).expect(201)).body.data as { id: string };
      const product = await createProduct(
        testApp.app,
        { brandId: new Types.ObjectId(brand.id), categoryId: new Types.ObjectId(category.id) },
        { variants: [{ price: 1_000, stock: 50 }] },
      );
      const areaId = await createArea(testApp.app, { name: 'Report Area', deliveryFee: 200 });
      const first = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 3 }] });
      const second = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 1 }] });
      await send('post', `orders/${second.order.id}/status`, { to: 'CANCELLED', reason: 'Testing reports' }).expect(200);

      const sales = (await admin.get('/api/admin/reports/sales').expect(200)).body.data;
      expect(sales.totals).toEqual({ orders: 1, revenue: first.order.total, averageOrder: first.order.total });
      expect(sales.series).toHaveLength(30);
      expect(sales.series.at(-1)).toMatchObject({ orders: 1, revenue: first.order.total });

      const top = (await admin.get('/api/admin/reports/top-products?limit=5').expect(200)).body.data;
      expect(top.byQuantity[0]).toMatchObject({ productId: product.id, qty: 3, revenue: 3_000 });

      const cod = (await admin.get('/api/admin/reports/cod').expect(200)).body.data;
      expect(cod.totals).toMatchObject({ collected: 0, pending: first.order.total, pendingOrders: 1 });
      expect(cod.byRider).toEqual([{ riderId: null, riderName: 'No rider yet', collected: 0, pending: first.order.total }]);

      // An explicit range is accepted (regression: the date format check once rejected every date).
      const today = karachiDateKey(new Date());
      const ranged = (await admin.get(`/api/admin/reports/sales?from=${today}&to=${today}`).expect(200)).body.data;
      expect(ranged.totals).toEqual(sales.totals);

      const reversed = await admin.get('/api/admin/reports/sales?from=2026-10-05&to=2026-10-01').expect(400);
      expect(reversed.body.error.details).toEqual([{ path: 'from', message: 'Pick a start date on or before the end date.' }]);
      await admin.get('/api/admin/reports/sales?from=2026-13-01').expect(400);

      const dashboard = (await admin.get('/api/admin/dashboard').expect(200)).body.data;
      expect(Object.keys(dashboard).sort()).toEqual(['codToCollect', 'lowStock', 'ordersByStatus', 'receiptsToVerify', 'sales']);
      expect(dashboard.sales.today).toEqual({ orders: 1, revenue: first.order.total });
      expect(dashboard.ordersByStatus).toMatchObject({ NEW: 1, CANCELLED: 1 });
    });
  });
});
