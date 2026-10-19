import type { ImportJobDTO } from '@aricon/shared';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLog } from '../src/models/audit-log.model.js';
import { Product, type ProductLean } from '../src/models/product.model.js';
import { StockMovement } from '../src/models/stock-movement.model.js';
import { PRODUCT_SHEET_COLUMNS } from '../src/modules/products/product-sheet.js';
import { ORIGIN } from './utils/auth.js';
import { createArea, createCatalogBasics, createProduct, modelOf, placeOrder, staffAgent, type Agent, type CatalogBasics } from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Supertest hands back the raw bytes of a download. */
function binary(res: { on: (event: string, cb: (chunk?: Buffer) => void) => void }, done: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk) => chunk && chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
}

function cellString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value);
}

async function readSheet(body: Buffer, name?: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(body).buffer);
  const sheet = name ? workbook.getWorksheet(name) : workbook.worksheets[0];
  const rows: string[][] = [];
  sheet?.eachRow((row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    rows.push(values.map(cellString));
  });
  return rows;
}

/** An import file in the template's shape. */
async function importFile(rows: Partial<Record<(typeof PRODUCT_SHEET_COLUMNS)[number], string | number>>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Products');
  sheet.addRow([...PRODUCT_SHEET_COLUMNS]);
  for (const row of rows) sheet.addRow(PRODUCT_SHEET_COLUMNS.map((column) => row[column] ?? null));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function waitForImport(agent: Agent, jobId: string): Promise<ImportJobDTO> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const job = (await agent.get(`/api/admin/import-jobs/${jobId}`).expect(200)).body.data as ImportJobDTO;
    if (job.status === 'DONE' || job.status === 'FAILED') return job;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('The import job did not finish');
}

/** Excel exports and the product import (SPEC §7.3, §12.3). */
describe('Spreadsheets', () => {
  let testApp: TestApp;
  let basics: CatalogBasics;
  let admin: Agent;
  let importerWithoutPrices: Agent; // products.import + edit_stock, no edit_price
  let viewer: Agent; // products.view only
  let categorySlug: string;
  let brandName: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    basics = await createCatalogBasics(testApp.app);
    ({ agent: admin } = await staffAgent(testApp.app, { role: 'ADMIN' }));
    ({ agent: importerWithoutPrices } = await staffAgent(testApp.app, { permissions: ['products.view', 'products.import', 'products.edit_stock'] }));
    ({ agent: viewer } = await staffAgent(testApp.app, { permissions: ['products.view', 'orders.view'] }));
    const categories = (await admin.get('/api/admin/categories').expect(200)).body.data as { id: string; slug: string }[];
    const brands = (await admin.get('/api/admin/brands').expect(200)).body.data as { id: string; name: string }[];
    categorySlug = categories.find((category) => category.id === String(basics.categoryId))?.slug ?? '';
    brandName = brands.find((brand) => brand.id === String(basics.brandId))?.name ?? '';
  });

  afterAll(async () => {
    await testApp?.close();
  });

  describe('exports', () => {
    it('gives the import template with the SPEC columns and instructions', async () => {
      const res = await admin.get('/api/admin/products/import-template').buffer(true).parse(binary).expect(200).expect('Content-Type', XLSX);
      const [header] = await readSheet(res.body as Buffer, 'Products');
      expect(header).toEqual([...PRODUCT_SHEET_COLUMNS]);
      expect((await readSheet(res.body as Buffer, 'Instructions')).length).toBeGreaterThan(10);
    });

    it('exports products one row per variant, in template order', async () => {
      await createProduct(testApp.app, basics, {
        name: 'Export Cement',
        variants: [
          { sku: 'EXP-OPC-50', price: 1_500, mrp: 1_600, stock: 40, bulkTiers: [{ minQty: 10, price: 1_450 }] },
          { sku: 'EXP-OPC-25', price: 800, stock: 5 },
        ],
      });
      const res = await admin.get('/api/admin/products/export?q=export%20cement').buffer(true).parse(binary).expect(200);
      const [header, ...rows] = await readSheet(res.body as Buffer);
      expect(header).toEqual([...PRODUCT_SHEET_COLUMNS]);
      const column = (name: string) => PRODUCT_SHEET_COLUMNS.indexOf(name as (typeof PRODUCT_SHEET_COLUMNS)[number]);
      expect(rows.map((row) => row[column('sku')])).toEqual(['EXP-OPC-50', 'EXP-OPC-25']);
      expect(rows[0]?.[column('price')]).toBe('1500');
      expect(rows[0]?.[column('tier1_min_qty')]).toBe('10');
      expect(rows[0]?.[column('category_slug')]).toBe(categorySlug);
    });

    it('exports orders, customers and reports, each behind its permission', async () => {
      const product = await createProduct(testApp.app, basics, { variants: [{ price: 1_000, stock: 50 }] });
      const areaId = await createArea(testApp.app, { name: 'Sheet Area', deliveryFee: 100 });
      const { order } = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 2 }] });

      const orders = await admin.get(`/api/admin/orders/export?q=${order.orderNumber}`).buffer(true).parse(binary).expect(200).expect('Content-Type', XLSX);
      const [, first] = await readSheet(orders.body as Buffer);
      expect(first?.[0]).toBe(order.orderNumber);

      await admin.get('/api/admin/customers/export').expect(200).expect('Content-Type', XLSX);
      await admin.get('/api/admin/reports/sales/export').expect(200).expect('Content-Type', XLSX);
      await admin.get('/api/admin/reports/top-products/export').expect(200);
      await admin.get('/api/admin/reports/cod/export').expect(200);

      await viewer.get('/api/admin/orders/export').expect(403);
      await viewer.get('/api/admin/products/export').expect(403);
      await viewer.get('/api/admin/reports/sales/export').expect(403);
    });
  });

  describe('product import', () => {
    it('creates, updates and reports rows, with IMPORT stock movements and an audit entry', async () => {
      const existing = await createProduct(testApp.app, basics, {
        name: 'Existing Paint',
        variants: [{ sku: 'IMP-PAINT-1', price: 2_000, mrp: 2_200, stock: 10, bulkTiers: [] }],
      });
      const file = await importFile([
        // A new product with two variants.
        { product_name: 'Import Cement', brand: brandName, category_slug: categorySlug, unit: 'bag', status: 'active', sku: 'IMP-CEM-50', variant_label: '50 kg bag', pack_size: '50 kg', mrp: 1_600, price: 1_500, tier1_min_qty: 10, tier1_price: 1_450, stock: 100 },
        { product_name: 'Import Cement', sku: 'IMP-CEM-25', variant_label: '25 kg bag', mrp: 850, price: 800, stock: 20 },
        // An existing SKU: new price and an absolute stock count.
        { product_slug: existing.slug, sku: 'IMP-PAINT-1', mrp: 2_200, price: 1_900, stock: 25 },
        // Broken rows.
        { product_name: 'Nowhere Product', brand: brandName, category_slug: 'no-such-category', unit: 'bag', sku: 'IMP-BAD-1', variant_label: 'x', mrp: 10, price: 10 },
        { product_name: 'Import Cement', sku: 'IMP-CEM-10', variant_label: '10 kg', mrp: 100, price: 120 },
      ]);

      const started = await admin
        .post('/api/admin/products/import')
        .set('Origin', ORIGIN)
        .attach('file', file, { filename: 'products.xlsx', contentType: XLSX })
        .expect(201);
      const job = await waitForImport(admin, (started.body.data as { jobId: string }).jobId);

      expect(job.status).toBe('DONE');
      expect(job.summary).toEqual({ created: 2, updated: 1, failed: 2 });
      expect(job.errors.map((error) => error.row).sort((a, b) => a - b)).toEqual([5, 6]);
      expect(job.errors.find((error) => error.row === 5)?.message).toContain('category_slug');

      const products = modelOf<Product>(testApp.app, Product.name);
      const created = await products.findOne({ slug: 'import-cement' }).lean<ProductLean>();
      expect(created?.status).toBe('active');
      expect(created?.variants.map((variant) => [variant.sku, variant.price, variant.stock])).toEqual([
        ['IMP-CEM-50', 1_500, 100],
        ['IMP-CEM-25', 800, 20],
      ]);
      expect(created?.variants[0]?.bulkTiers).toEqual([expect.objectContaining({ minQty: 10, price: 1_450 })]);

      const updated = await products.findById(existing.id).lean<ProductLean>();
      expect(updated?.variants[0]).toMatchObject({ price: 1_900, stock: 25 });

      const movements = await modelOf<StockMovement>(testApp.app, StockMovement.name).find({ sku: 'IMP-PAINT-1' }).lean();
      expect(movements).toEqual([expect.objectContaining({ reason: 'IMPORT', change: 15, stockAfter: 25 })]);

      const actions = (await modelOf<AuditLog>(testApp.app, AuditLog.name).find({}, { action: 1 }).lean()).map((entry) => entry.action);
      expect(actions).toEqual(expect.arrayContaining(['product.price_changed', 'products.imported']));
    });

    it('ignores price columns for importers without price permission and refuses their new SKUs', async () => {
      const existing = await createProduct(testApp.app, basics, { variants: [{ sku: 'NOPRICE-1', price: 500, stock: 3 }] });
      const file = await importFile([
        { product_slug: existing.slug, sku: 'NOPRICE-1', price: 1, stock: 9 },
        { product_slug: existing.slug, sku: 'NOPRICE-2', variant_label: 'New', mrp: 600, price: 550 },
      ]);
      const started = await importerWithoutPrices
        .post('/api/admin/products/import')
        .set('Origin', ORIGIN)
        .attach('file', file, { filename: 'p.xlsx', contentType: XLSX })
        .expect(201);
      const job = await waitForImport(importerWithoutPrices, (started.body.data as { jobId: string }).jobId);
      expect(job.summary).toEqual({ created: 0, updated: 1, failed: 1 });
      expect(job.errors[0]?.message).toContain('price permission');

      const product = await modelOf<Product>(testApp.app, Product.name).findById(existing.id).lean<ProductLean>();
      expect(product?.variants).toEqual([expect.objectContaining({ sku: 'NOPRICE-1', price: 500, stock: 9 })]);
    });

    it('refuses files that are not xlsx and needs the import permission', async () => {
      await admin
        .post('/api/admin/products/import')
        .set('Origin', ORIGIN)
        .attach('file', Buffer.from('sku,price\nA,1\n'), { filename: 'p.xlsx', contentType: XLSX })
        .expect(415);
      await viewer
        .post('/api/admin/products/import')
        .set('Origin', ORIGIN)
        .attach('file', await importFile([]), { filename: 'p.xlsx', contentType: XLSX })
        .expect(403);
    });
  });
});

