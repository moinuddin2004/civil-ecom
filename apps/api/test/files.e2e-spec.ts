import type { AdminOrderDTO, CustomerOrderDTO, FileLinkDTO } from '@aricon/shared';
import { Types } from 'mongoose';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MailService } from '../src/modules/notifications/mail.service.js';
import { ORIGIN } from './utils/auth.js';
import { createArea, createCatalogBasics, createProduct, placeOrder, staffAgent, type Agent, type CatalogBasics, type CreatedProduct } from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** A real PNG of the given width (sharp makes it), to upload. */
function png(width: number, height = width): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 220, g: 140, b: 30 } } }).png().toBuffer();
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n', 'latin1');

/** The path part of a signed link (supertest talks to the app directly, not through APP_URL). */
function pathOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

/** Files (SPEC §12, §6.8, CLAUDE.md §30): uploads, receipts, private links and invoices. */
describe('Files', () => {
  let testApp: TestApp;
  let basics: CatalogBasics;
  let admin: Agent;
  let catalogEditor: Agent; // products.edit only
  let orderViewer: Agent; // no orders.view
  let product: CreatedProduct;
  let areaId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    basics = await createCatalogBasics(testApp.app);
    ({ agent: admin } = await staffAgent(testApp.app, { role: 'ADMIN' }));
    ({ agent: catalogEditor } = await staffAgent(testApp.app, { permissions: ['products.view', 'products.edit'] }));
    ({ agent: orderViewer } = await staffAgent(testApp.app, { permissions: ['products.view'] }));
    product = await createProduct(testApp.app, basics, { variants: [{ price: 1_000, stock: 100 }] });
    areaId = await createArea(testApp.app, { name: 'Files Area', deliveryFee: 200 });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const http = () => testApp.app.getHttpServer() as Parameters<typeof request>[0];

  describe('admin image uploads', () => {
    it('stores a product photo as 300/800/1600 WebP without upscaling', async () => {
      const res = await catalogEditor
        .post('/api/admin/uploads/product-image')
        .set('Origin', ORIGIN)
        .attach('file', await png(1200, 900), { filename: 'photo.png', contentType: 'image/png' })
        .expect(201);
      const { key, productId } = res.body.data as { key: string; productId: string };
      expect(key).toMatch(new RegExp(`^products/${productId}/[a-f0-9]{24}$`));

      const sizes = await Promise.all(
        [300, 800, 1600].map(async (width) => {
          const file = await request(http()).get(`/api/dev-files/${key}/${width}.webp`).buffer(true).expect(200).expect('Content-Type', 'image/webp');
          return (await sharp(file.body as Buffer).metadata()).width;
        }),
      );
      expect(sizes).toEqual([300, 800, 1200]);
    });

    it('keeps the owner id it was given, so a product can be created with the photo', async () => {
      const productId = new Types.ObjectId().toHexString();
      const upload = await admin
        .post('/api/admin/uploads/product-image')
        .set('Origin', ORIGIN)
        .field('productId', productId)
        .attach('file', await png(400), { filename: 'a.png', contentType: 'image/png' })
        .expect(201);
      const { key } = upload.body.data as { key: string };
      expect(key.startsWith(`products/${productId}/`)).toBe(true);

      const created = await admin
        .post('/api/admin/products')
        .set('Origin', ORIGIN)
        .send({
          id: productId,
          name: 'Photo Cement',
          brandId: String(basics.brandId),
          categoryId: String(basics.categoryId),
          unit: 'bag',
          images: [{ key, alt: 'Bag front' }],
          variants: [{ sku: `photo-${productId.slice(-6)}`, label: '50 kg bag', mrp: 1_100, price: 1_000 }],
        })
        .expect(201);
      expect(created.body.data.images).toEqual([expect.objectContaining({ key, alt: 'Bag front' })]);
    });

    it('refuses files that are not really images, whatever they claim', async () => {
      const res = await admin
        .post('/api/admin/uploads/product-image')
        .set('Origin', ORIGIN)
        .attach('file', Buffer.from('<svg onload="alert(1)"></svg>'), { filename: 'evil.png', contentType: 'image/png' })
        .expect(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_FILE');
    });

    it('refuses files over 8 MB while they stream in', async () => {
      const res = await admin
        .post('/api/admin/uploads/banner')
        .set('Origin', ORIGIN)
        .field('variant', 'desktop')
        .attach('file', Buffer.alloc(8 * 1024 * 1024 + 1, 1), { filename: 'big.jpg', contentType: 'image/jpeg' })
        .expect(413);
      expect(res.body.error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', message: expect.stringContaining('8.0 MB') });
    });

    it('needs the matching permission', async () => {
      await request(http()).post('/api/admin/uploads/category-image').set('Origin', ORIGIN).attach('file', await png(10), 'a.png').expect(401);
      await catalogEditor
        .post('/api/admin/uploads/category-image')
        .set('Origin', ORIGIN)
        .attach('file', await png(10), { filename: 'a.png', contentType: 'image/png' })
        .expect(403);
    });

    it('stores banners, category images and brand logos under their owner', async () => {
      const banner = await admin
        .post('/api/admin/uploads/banner')
        .set('Origin', ORIGIN)
        .field('variant', 'mobile')
        .attach('file', await png(2000, 600), { filename: 'b.png', contentType: 'image/png' })
        .expect(201);
      expect(banner.body.data.key).toBe(`banners/${banner.body.data.bannerId as string}/mobile.webp`);

      const logo = await admin
        .post('/api/admin/uploads/brand-logo')
        .set('Origin', ORIGIN)
        .field('brandId', String(basics.brandId))
        .attach('file', await png(900), { filename: 'l.png', contentType: 'image/png' })
        .expect(201);
      expect(logo.body.data).toEqual({ key: `brands/${String(basics.brandId)}/logo.webp`, brandId: String(basics.brandId) });
    });
  });

  describe('dev file server', () => {
    it('never serves anything outside the storage folder', async () => {
      await request(http()).get('/api/dev-files/..%2F..%2Fpackage.json').expect(404);
      await request(http()).get('/api/dev-files/products/../../package.json').expect(404);
    });
  });

  describe('bank transfer receipts', () => {
    it('takes a receipt, marks the payment as awaiting verification and lets staff open it for 10 minutes', async () => {
      const { agent: customer, order } = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 2 }], paymentMethod: 'BANK_TRANSFER' });

      const uploaded = await customer
        .post(`/api/orders/${order.orderNumber}/receipts`)
        .set('Origin', ORIGIN)
        .attach('file', PDF, { filename: 'receipt.pdf', contentType: 'application/pdf' })
        .expect(201);
      const after = uploaded.body.data as CustomerOrderDTO;
      expect(after.paymentStatus).toBe('AWAITING_VERIFICATION');
      expect(after.receipts).toEqual([expect.objectContaining({ status: 'pending' })]);

      const adminOrder = (await admin.get(`/api/admin/orders/${order.id}`).expect(200)).body.data as AdminOrderDTO;
      const receiptId = adminOrder.receipts[0]?.id ?? '';
      const link = (await admin.get(`/api/admin/orders/${order.id}/receipts/${receiptId}/url`).expect(200)).body.data as FileLinkDTO;
      expect(new Date(link.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(10 * 60 * 1000);

      const file = await request(http()).get(pathOf(link.url)).buffer(true).expect(200).expect('Content-Type', 'application/pdf');
      expect(Buffer.from(file.body as Buffer).equals(PDF)).toBe(true);

      // A tampered or unsigned link opens nothing.
      await request(http()).get(pathOf(link.url).replace(/signature=[^&]+/, 'signature=forged')).expect(403);
      await request(http()).get(new URL(link.url).pathname).expect(403);
      // Staff without orders.view can't get a link.
      await orderViewer.get(`/api/admin/orders/${order.id}/receipts/${receiptId}/url`).expect(403);
    });

    it('re-encodes receipt photos and allows at most 3 waiting at once', async () => {
      const { agent: customer, order } = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 1 }], paymentMethod: 'BANK_TRANSFER' });
      for (let i = 0; i < 3; i += 1) {
        await customer
          .post(`/api/orders/${order.orderNumber}/receipts`)
          .set('Origin', ORIGIN)
          .attach('file', await png(50), { filename: 'r.png', contentType: 'image/png' })
          .expect(201);
      }
      const fourth = await customer
        .post(`/api/orders/${order.orderNumber}/receipts`)
        .set('Origin', ORIGIN)
        .attach('file', await png(50), { filename: 'r.png', contentType: 'image/png' })
        .expect(409);
      expect(fourth.body.error.message).toContain('3 receipts');
    });

    it('refuses receipts for cash on delivery orders and for other customers', async () => {
      const cod = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 1 }], paymentMethod: 'COD' });
      await cod.agent
        .post(`/api/orders/${cod.order.orderNumber}/receipts`)
        .set('Origin', ORIGIN)
        .attach('file', PDF, { filename: 'r.pdf', contentType: 'application/pdf' })
        .expect(409);

      const bank = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 1 }], paymentMethod: 'BANK_TRANSFER' });
      await cod.agent
        .post(`/api/orders/${bank.order.orderNumber}/receipts`)
        .set('Origin', ORIGIN)
        .attach('file', PDF, { filename: 'r.pdf', contentType: 'application/pdf' })
        .expect(404);
    });
  });

  describe('invoices', () => {
    it('gives the customer and staff a PDF, and nobody else', async () => {
      const { agent: customer, order } = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 3 }] });
      const mine = await customer.get(`/api/orders/${order.orderNumber}/invoice`).buffer(true).expect(200).expect('Content-Type', 'application/pdf');
      expect((mine.body as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(mine.headers['content-disposition']).toContain(`invoice-${order.orderNumber}.pdf`);

      await admin.get(`/api/admin/orders/${order.id}/invoice`).expect(200).expect('Content-Type', 'application/pdf');
      await orderViewer.get(`/api/admin/orders/${order.id}/invoice`).expect(403);

      const other = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 1 }] });
      await other.agent.get(`/api/orders/${order.orderNumber}/invoice`).expect(404);
    });
  });

  describe('emails', () => {
    it('sends notifications through the send-email job, rendered as HTML and text', async () => {
      const mail = testApp.app.get(MailService);
      const send = vi.spyOn(mail, 'send');
      const { order } = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 1 }], paymentMethod: 'BANK_TRANSFER' });

      await vi.waitFor(
        () => {
          const placed = send.mock.calls.find(([email]) => email.subject === `Order ${order.orderNumber} placed`);
          expect(placed?.[0]).toMatchObject({ html: expect.stringContaining(order.orderNumber), text: expect.stringContaining('Upload receipt') });
        },
        { timeout: 10_000, interval: 100 },
      );
      send.mockRestore();
    });
  });
});
