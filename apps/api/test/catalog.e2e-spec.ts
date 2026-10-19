import type { ProductCard, ProductListResponse } from '@aricon/shared';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Brand } from '../src/models/brand.model.js';
import { Category } from '../src/models/category.model.js';
import { DeliveryArea } from '../src/models/delivery-area.model.js';
import { Homepage, HOMEPAGE_ID } from '../src/models/homepage.model.js';
import { Product } from '../src/models/product.model.js';
import { Settings, SETTINGS_ID } from '../src/models/settings.model.js';
import { createCatalogBasics, createProduct } from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/*
 * Public catalog (SPEC §7.2) against a real replica set. Fixture:
 *
 *   Cement (home tile)          Tiles             Paints (hidden)
 *   └─ OPC cement
 *
 *   Lucky OPC Cement   Lucky · OPC cement   1,450   in stock     featured
 *   DG PPC Cement      DG    · Cement       1,150–1,400 (40/50 kg)
 *   Master Floor Tile  DG    · Tiles        2,200   out of stock  related → Lucky OPC
 *   Lucky White Cement Lucky · OPC cement   hidden product
 */

const slugs = (cards: { slug: string }[]) => cards.map((card) => card.slug);

describe('Public catalog', () => {
  let testApp: TestApp;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as Parameters<typeof request>[0];
    const model = <T>(name: string) => testApp.app.get<Model<T>>(getModelToken(name));

    const brands = model<Brand>(Brand.name);
    const [lucky, dg] = await brands.create([
      { name: 'Lucky Cement', slug: 'lucky-cement', sortOrder: 2 },
      { name: 'DG Cement', slug: 'dg-cement', sortOrder: 1 },
    ]);
    await brands.create({ name: 'Old Brand', slug: 'old-brand', status: 'hidden' });

    const categories = model<Category>(Category.name);
    const [cement, tiles] = await categories.create([
      { name: 'Cement', slug: 'cement', showOnHome: true, sortOrder: 1 },
      { name: 'Tiles', slug: 'tiles', sortOrder: 2 },
    ]);
    const opc = await categories.create({ name: 'OPC cement', slug: 'opc-cement', parentId: cement!._id });
    await categories.create({ name: 'Paints', slug: 'paints', status: 'hidden' });

    const products = model<Product>(Product.name);
    await products.init(); // the text index must exist before `?q=` searches
    const variant = (sku: string, price: number, stock: number, options: Record<string, string> = {}) => ({
      sku,
      label: Object.values(options).join(', ') || sku,
      options,
      mrp: price + 50,
      price,
      stock,
    });
    const luckyOpc = await products.create({
      name: 'Lucky OPC Cement',
      slug: 'lucky-opc-cement',
      brandId: lucky!._id,
      categoryId: opc._id,
      type: 'OPC',
      unit: 'bag',
      isFeatured: true,
      status: 'active',
      variants: [{ ...variant('LUCKY-OPC-50', 1_450, 100, { packSize: '50 kg' }), bulkTiers: [{ minQty: 50, price: 1_420 }] }],
    });
    const dgPpc = await products.create({
      name: 'DG PPC Cement',
      slug: 'dg-ppc-cement',
      brandId: dg!._id,
      categoryId: cement!._id,
      type: 'PPC',
      unit: 'bag',
      status: 'active',
      variants: [
        variant('DG-PPC-50', 1_400, 0, { packSize: '50 kg' }),
        variant('DG-PPC-40', 1_150, 20, { packSize: '40 kg' }),
        { ...variant('DG-PPC-25', 700, 5, { packSize: '25 kg' }), isActive: false },
      ],
    });
    await products.create({
      name: 'Master Floor Tile',
      slug: 'master-floor-tile',
      brandId: dg!._id,
      categoryId: tiles!._id,
      unit: 'box',
      status: 'active',
      relatedProductIds: [luckyOpc._id],
      variants: [variant('TILE-IVORY', 2_200, 0, { colour: 'Ivory' }), variant('TILE-GREY', 2_200, 0, { colour: 'Grey' })],
    });
    const hidden = await products.create({
      name: 'Lucky White Cement',
      slug: 'lucky-white-cement',
      brandId: lucky!._id,
      categoryId: opc._id,
      unit: 'bag',
      status: 'hidden',
      variants: [variant('LUCKY-WHITE', 2_000, 10)],
    });

    await model<Homepage>(Homepage.name).create({
      _id: HOMEPAGE_ID,
      banners: [
        { desktopKey: 'banners/b2/desktop.webp', alt: 'Second', sortOrder: 2 },
        { desktopKey: 'banners/off/desktop.webp', alt: 'Switched off', isActive: false },
        { desktopKey: 'banners/b1/desktop.webp', alt: 'First', link: '/category/cement', sortOrder: 1 },
      ],
      featuredProductIds: [hidden._id, luckyOpc._id],
      dealProductIds: [dgPpc._id],
    });

    await model<Settings>(Settings.name).create({
      _id: SETTINGS_ID,
      storeName: 'Aricon Shop',
      whatsapp: '+923001234567',
      defaultDeliveryFee: 400,
      codMaxOrderAmount: 200_000,
      bankAccounts: [{ bankName: 'Meezan Bank', accountTitle: 'Aricon', accountNumber: '0101' }],
      pages: { refundPolicy: '# Refunds\n\nWithin 7 days.' },
    });

    await model<DeliveryArea>(DeliveryArea.name).create([
      { name: 'Gulshan-e-Iqbal', sortOrder: 1 },
      { name: 'DHA', deliveryFee: 300, freeDeliveryAbove: 50_000, sortOrder: 2 },
      { name: 'Gadap', isServiceable: false, sortOrder: 3 },
    ]);
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const get = (path: string) => request(server).get(path);

  describe('GET /api/home', () => {
    it('returns active banners in order, home tiles, picks without hidden products, and new arrivals', async () => {
      const { body } = await get('/api/home').expect(200);
      const home = body.data;
      expect(home.banners.map((banner: { alt: string }) => banner.alt)).toEqual(['First', 'Second']);
      expect(home.banners[0]).toMatchObject({ link: '/category/cement', mobileKey: null });
      expect(home.categoryTiles).toEqual([expect.objectContaining({ slug: 'cement', productCount: 2 })]);
      expect(slugs(home.featured)).toEqual(['lucky-opc-cement']);
      expect(slugs(home.deals)).toEqual(['dg-ppc-cement']);
      expect(slugs(home.newArrivals).sort()).toEqual(['dg-ppc-cement', 'lucky-opc-cement', 'master-floor-tile']);
      expect(slugs(home.brands)).toEqual(['dg-cement', 'lucky-cement']);
    });
  });

  describe('categories and brands', () => {
    it('GET /api/categories: active tree with counts that include sub-categories', async () => {
      const { body } = await get('/api/categories').expect(200);
      expect(body.data.map((node: { slug: string; productCount: number }) => [node.slug, node.productCount])).toEqual([
        ['cement', 2],
        ['tiles', 1],
      ]);
      expect(body.data[0].children).toEqual([expect.objectContaining({ slug: 'opc-cement', productCount: 1 })]);
    });

    it('GET /api/categories/:slug: a sub-category with its parent and breadcrumbs', async () => {
      const { body } = await get('/api/categories/opc-cement').expect(200);
      expect(body.data.parent).toMatchObject({ slug: 'cement' });
      expect(slugs(body.data.children)).toEqual(['opc-cement']);
      expect(slugs(body.data.breadcrumbs)).toEqual(['cement', 'opc-cement']);
    });

    it('answers 404 for hidden, unknown and malformed category slugs', async () => {
      for (const slug of ['paints', 'no-such-thing', 'Not_A_Slug']) {
        const { body } = await get(`/api/categories/${slug}`).expect(404);
        expect(body.error.code).toBe('NOT_FOUND');
      }
    });

    it('GET /api/brands: active brands in display order', async () => {
      const { body } = await get('/api/brands').expect(200);
      expect(slugs(body.data)).toEqual(['dg-cement', 'lucky-cement']);
      expect(body.data[0]).toEqual({ id: expect.any(String), name: 'DG Cement', slug: 'dg-cement', logoKey: null });
    });
  });

  describe('GET /api/products', () => {
    const list = async (query = '') => (await get(`/api/products${query}`).expect(200)).body as ProductListResponse;

    it('lists active products with meta and facets', async () => {
      const result = await list();
      expect(result.meta).toEqual({ page: 1, pageSize: 20, total: 3 });
      expect(slugs(result.data)).not.toContain('lucky-white-cement');
      expect(result.facets.brands.map((row) => [row.slug, row.count])).toEqual([
        ['dg-cement', 2],
        ['lucky-cement', 1],
      ]);
      expect(result.facets.price).toEqual({ min: 1_150, max: 2_200 });
      // Only active variants feed the filters: no "25 kg".
      expect(result.facets.values.packSize).toEqual([
        { value: '50 kg', count: 2 },
        { value: '40 kg', count: 1 },
      ]);
      expect(result.facets.values.type.map((row) => row.value).sort()).toEqual(['OPC', 'PPC']);
    });

    it('builds product cards from active variants', async () => {
      const result = await list('?category=cement&sort=price_asc');
      const dg = result.data.find((card) => card.slug === 'dg-ppc-cement') as ProductCard;
      expect(dg).toMatchObject({
        brandName: 'DG Cement',
        minPrice: 1_150,
        maxPrice: 1_400,
        mrpOfMin: 1_200,
        variantCount: 2,
        inStock: true,
        lowestTierPrice: null,
      });
      const lucky = result.data.find((card) => card.slug === 'lucky-opc-cement') as ProductCard;
      expect(lucky.lowestTierPrice).toBe(1_420);
    });

    it('filters by category including sub-categories, and sorts by price', async () => {
      expect(slugs((await list('?category=cement&sort=price_asc')).data)).toEqual(['dg-ppc-cement', 'lucky-opc-cement']);
      expect(slugs((await list('?category=cement&sort=price_desc')).data)).toEqual(['lucky-opc-cement', 'dg-ppc-cement']);
    });

    it('brand facet ignores its own filter; unknown brands match nothing', async () => {
      const lucky = await list('?brand=lucky-cement');
      expect(slugs(lucky.data)).toEqual(['lucky-opc-cement']);
      expect(lucky.facets.brands.map((row) => row.slug)).toEqual(['dg-cement', 'lucky-cement']);

      const none = await list('?brand=no-such-brand');
      expect(none.meta.total).toBe(0);
      expect(none.facets.price).toBeNull();
    });

    it('filters by option values, stock, price range and search text', async () => {
      expect(slugs((await list('?packSize=40%20kg')).data)).toEqual(['dg-ppc-cement']);
      expect(slugs((await list('?inStock=true&sort=price_asc')).data)).toEqual(['dg-ppc-cement', 'lucky-opc-cement']);
      expect(slugs((await list('?minPrice=1500&maxPrice=3000')).data)).toEqual(['master-floor-tile']);
      expect(slugs((await list('?q=lucky')).data)).toEqual(['lucky-opc-cement']);
    });

    it('paginates', async () => {
      const page = await list('?pageSize=1&page=2&sort=price_asc');
      expect(page.meta).toEqual({ page: 2, pageSize: 1, total: 3 });
      expect(slugs(page.data)).toEqual(['lucky-opc-cement']);
    });

    it('rejects bad queries with field errors, and an unknown category with 404', async () => {
      const bad = await get('/api/products?pageSize=101&sort=cheapest&inStock=yes&evil=1').expect(400);
      expect(bad.body.error.code).toBe('VALIDATION_ERROR');
      expect(bad.body.error.details.map((issue: { path: string }) => issue.path).sort()).toEqual([
        'evil',
        'inStock',
        'pageSize',
        'sort',
      ]);
      await get('/api/products?category=paints').expect(404);
    });
  });

  describe('product pages', () => {
    it('GET /api/products/:slug: full product with active variants only', async () => {
      const { body } = await get('/api/products/dg-ppc-cement').expect(200);
      const product = body.data;
      expect(product.brand).toMatchObject({ slug: 'dg-cement' });
      expect(product.category).toMatchObject({ slug: 'cement' });
      expect(product.breadcrumbs).toEqual([{ name: 'Cement', slug: 'cement' }]);
      expect(product.variants.map((variant: { sku: string }) => variant.sku)).toEqual(['DG-PPC-50', 'DG-PPC-40']);
      expect(product.optionKeys).toEqual(['packSize']);
      expect(product.seo).toEqual({ title: null, description: null });
    });

    it('serves a product whose variant has no options (empty options are kept)', async () => {
      const basics = await createCatalogBasics(testApp.app);
      const plain = await createProduct(testApp.app, basics, { variants: [{ price: 100, stock: 5 }] });
      const { body } = await get(`/api/products/${plain.slug}`).expect(200);
      expect(body.data.variants[0].options).toEqual({});
      expect(body.data.optionKeys).toEqual([]);
    });

    it('answers 404 for a hidden product', async () => {
      await get('/api/products/lucky-white-cement').expect(404);
      await get('/api/products/lucky-white-cement/related').expect(404);
    });

    it('related: hand-picked products first, otherwise the same category', async () => {
      expect(slugs((await get('/api/products/master-floor-tile/related').expect(200)).body.data)).toEqual([
        'lucky-opc-cement',
      ]);
      // DG PPC has no picks: other active products in Cement (and OPC cement under it), not itself.
      expect(slugs((await get('/api/products/dg-ppc-cement/related').expect(200)).body.data)).toEqual([
        'lucky-opc-cement',
      ]);
    });
  });

  describe('GET /api/search/suggest', () => {
    it('needs at least 2 characters', async () => {
      const { body } = await get('/api/search/suggest?q=l').expect(200);
      expect(body.data).toEqual({ products: [], categories: [], brands: [] });
    });

    it('matches partial words in products, categories and brands (active only)', async () => {
      const { body } = await get('/api/search/suggest?q=LUC').expect(200);
      expect(slugs(body.data.products)).toEqual(['lucky-opc-cement']);
      expect(body.data.brands).toEqual([{ name: 'Lucky Cement', slug: 'lucky-cement' }]);

      const cement = await get('/api/search/suggest?q=cem').expect(200);
      expect(slugs(cement.body.data.categories).sort()).toEqual(['cement', 'opc-cement']);
    });

    it('treats regex characters as plain text', async () => {
      const { body } = await get(`/api/search/suggest?q=${encodeURIComponent('.*')}`).expect(200);
      expect(body.data.products).toEqual([]);
    });
  });

  describe('store settings and delivery', () => {
    it('GET /api/delivery-areas: every area with its effective fee', async () => {
      const { body } = await get('/api/delivery-areas').expect(200);
      expect(body.data.map(({ name, isServiceable, deliveryFee, freeDeliveryAbove }: Record<string, unknown>) => ({
        name,
        isServiceable,
        deliveryFee,
        freeDeliveryAbove,
      }))).toEqual([
        { name: 'Gulshan-e-Iqbal', isServiceable: true, deliveryFee: 400, freeDeliveryAbove: null },
        { name: 'DHA', isServiceable: true, deliveryFee: 300, freeDeliveryAbove: 50_000 },
        { name: 'Gadap', isServiceable: false, deliveryFee: 400, freeDeliveryAbove: null },
      ]);
    });

    it('GET /api/settings/public: contact details and payment options, nothing internal', async () => {
      const { body } = await get('/api/settings/public').expect(200);
      expect(body.data).toMatchObject({
        storeName: 'Aricon Shop',
        whatsapp: '+923001234567',
        paymentMethods: { cod: true, bankTransfer: true },
        codMaxOrderAmount: 200_000,
        defaultDeliveryFee: 400,
        bankAccounts: [{ bankName: 'Meezan Bank', accountNumber: '0101', iban: null, raastId: null }],
      });
      expect(body.data).not.toHaveProperty('orderNotificationEmails');
      expect(body.data).not.toHaveProperty('rfpEmail');
      expect(body.data).not.toHaveProperty('pages');
    });

    it('GET /api/pages/:key: content by URL slug; unknown pages are 404', async () => {
      const { body } = await get('/api/pages/refund-policy').expect(200);
      expect(body.data).toEqual({ key: 'refund-policy', title: 'Refund policy', body: '# Refunds\n\nWithin 7 days.' });
      expect((await get('/api/pages/terms').expect(200)).body.data.body).toBe('');
      await get('/api/pages/refundPolicy').expect(404);
      await get('/api/pages/secrets').expect(404);
    });
  });
});
